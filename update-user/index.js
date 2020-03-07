const Auth = require('thankshell-libs/auth.js');
const AWS = require("aws-sdk");

class UserError extends Error {}

const updateUser = async(userId, user) => {
    console.log(`Update user: ${userId}`)
    console.log(`Update data: ${user}`)

    const dynamo = new AWS.DynamoDB.DocumentClient();

    await dynamo.update({
        TableName: process.env.USERS_TABLE_NAME,
        Key:{
            'user_id': userId,
        },
        UpdateExpression: 'SET display_name = :display_name',
        ExpressionAttributeValues: {
            ':display_name': user.displayName,
        },
    }).promise()
}

const run = async(event) => {
    console.log(`EventBody: ${event.body}`)
    console.log(`PathParameter: ${event.pathParameters}`)

    const userId = event.pathParameters.userId
    if (!userId) {
        throw new UserError('userId is not set in path parameters')
    }
    if (userId !== await Auth.getUserId(event.requestContext.authorizer.claims)) {
        throw new UserError('No access permission')
    }

    const eventBody = JSON.parse(event.body)

    await updateUser(userId, eventBody)
}

exports.handler = async(event, context, callback) => {
    try {
        console.log(event)
        await run(event)

        return {
            statusCode: 200,
            headers: {"Access-Control-Allow-Origin": "*"},
            body: JSON.stringify({}),
        }
    } catch(err) {
        console.log(err);

        return {
            statusCode: 500,
            headers: {"Access-Control-Allow-Origin": "*"},
            body: JSON.stringify({
                'message': err.message,
            }),
        }
    }
}
