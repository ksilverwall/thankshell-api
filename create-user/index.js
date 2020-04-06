const Auth = require('thankshell-libs/auth.js');
const AWS = require("aws-sdk");

class ApplicationError extends Error {
  constructor(message, errorCode="UNKNOWN_ERROR", statusCode=500) {
    super(message)
    this.statusCode = statusCode
    this.errorCode = errorCode
  }
}

const getUser = async(dynamo, userId) => {
    const result = await dynamo.get({
        TableName: process.env.USERS_TABLE_NAME,
        Key:{
            'user_id': userId,
        },
    }).promise()

    return result.Item
}

const registerUser = async(dynamo, userId, claims) => {
    await dynamo.put({
        TableName: process.env.USERS_TABLE_NAME,
        Item: {
            user_id: userId,
            status: 'ENABLE',
        }
    }).promise()

    if (claims.identities) {
        const identities = JSON.parse(claims.identities);
        const authId = identities.providerType + ':' + identities.userId;
        await dynamo.update({
            TableName: process.env.AUTH_TABLE_NAME,
            Key:{
                'auth_id': authId,
            },
            UpdateExpression: 'SET user_id = :value',
            ExpressionAttributeValues: {
                ':value': userId,
            },
        }).promise()
    }
}

const run = async(event) => {
    const dynamo = new AWS.DynamoDB.DocumentClient()

    const claims = event.requestContext.authorizer.claims
    const body = JSON.parse(event.body)

    const userInfo = await Auth.getUserInfo(claims)

    if(userInfo.status != 'UNREGISTERED') {
        throw new ApplicationError(
            "指定された認証情報はすでに登録されています",
            "AUTHINFO_ALREADY_REGISTERD",
            403,
        )
    }

    const userId = body.id
    if (await getUser(dynamo, userId)) {
        throw new ApplicationError(
            "指定したIDは既に使用されています",
            "ID_ALREADY_REGISTERD",
            403,
        )
    }

    await registerUser(dynamo, userId, claims)
}

const getSuccessMessage = () => {
    return {
        statusCode: 200,
        headers: {"Access-Control-Allow-Origin": "*"},
        body: JSON.stringify({}),
    }
}

const getErrorResponse = (err) => {
    const responseBody = (err instanceof ApplicationError) ? {
        'code': err.errorCode,
        'message': err.message,
    } : {
        'code': 'UNKNOWN_ERROR',
        'message': err.message,
    }

    return {
        statusCode: (err instanceof ApplicationError) ? err.statusCode : 500,
        headers: {"Access-Control-Allow-Origin": "*"},
        body: JSON.stringify(responseBody),
    }
}

exports.handler = async(event, context, callback) => {
    try {
        await run(event);

        return getSuccessMessage()
    } catch(err) {
        console.log(err);

        return getErrorResponse(err)
    }
}
