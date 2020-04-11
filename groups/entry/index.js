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


const entryToGroup = async(dynamo, groupId, memberId, claims) => {
    // FIXME: set memberId related with groupId
    const result = memberId.match(/^\w+$/g)
    if (!result) {
        throw new ApplicationError(
            "IDには英数字を指定してください",
            "INVALID_MEMBERID_FORMAT",
            403,
        )
    }

    // FIXME: set memberId related with groupId
    const userInfo = await Auth.getUserInfo(claims)
    if(userInfo.status != 'UNREGISTERED') {
        throw new ApplicationError(
            `ユーザはすでに登録されています(${userInfo.user_id})`,
            "ALREADY_MEMBER_USER",
            403,
        )
    }

    // FIXME: set memberId related with groupId
    if (await getUser(dynamo, memberId)) {
        throw new ApplicationError(
            "指定のMemberIDは既に登録されています",
            "ALREADY_REGISTERD_MEMBERID",
            403,
        )
    }

    await dynamo.put({
        TableName: process.env.USERS_TABLE_NAME,
        Item: {
            user_id: memberId,
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
                ':value': memberId,
            },
        }).promise()
    }
}


const run = async(event) => {
    const dynamo = new AWS.DynamoDB.DocumentClient()

    const groupId = event.pathParameters.group
    const memberId = event.pathParameters.member
    const claims = event.requestContext.authorizer.claims

    console.log(`clains: ${JSON.stringify(claims)}`)

    await entryToGroup(dynamo, groupId, memberId, claims)
}

//-----------------------------------------------
// Lambda Handler

const getSuccessResponse = () => {
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
        await run(event)

        return getSuccessResponse()
    } catch(err) {
        console.error(err)

        return getErrorResponse(err)
    }
}
