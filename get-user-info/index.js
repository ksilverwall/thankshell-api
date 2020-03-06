const Auth = require('thankshell-libs/auth.js');
const AWS = require("aws-sdk");

// FIXME: Register to auth module
const getUser = async(dynamo, userId) => {
    if (!userId) {
        return {
            status: 'UNREGISTERED',
        }
    }

    let result = await dynamo.get({
        TableName: process.env.USERS_TABLE_NAME,
        Key:{
            'user_id': userId,
        },
    }).promise();

    if (result.Item) {
        return {
            status: result.Item.status,
            user_id: result.Item.user_id,
            displayName: result.Item.display_name ? result.Item.display_name : result.Item.user_id,
        };
    } else {
        return {
            status: 'UNREGISTERED',
            'user_id': userId,
        };
    }
}

const run = async(event) => {
    const dynamo = new AWS.DynamoDB.DocumentClient()
    const userId = await Auth.getUserId(event.requestContext.authorizer.claims)

    return await getUser(dynamo, userId)
};

exports.handler = async (event, context, callback) => {
    try {
        const result = await run(event);

        return {
            statusCode: 200,
            headers: {"Access-Control-Allow-Origin": "*"},
            body: JSON.stringify(result),
        };
    } catch(err) {
        console.log(err);

        return {
            statusCode: 500,
            headers: {"Access-Control-Allow-Origin": "*"},
            body: JSON.stringify({
                "message": err.message,
            }),
        };
    }
};
