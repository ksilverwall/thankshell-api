const Auth = require('thankshell-libs/auth.js');
const AWS = require("aws-sdk")

const getJoinedGroups = async(userId) => {
    const client = new AWS.DynamoDB.DocumentClient()

    const data = await client.scan({
        TableName: process.env.GROUPS_TABLE_NAME,
        ProjectionExpression: "group_id",
        FilterExpression: "contains(#members, :user_id)",
        ExpressionAttributeNames:{
            '#members': 'members'
        },
        ExpressionAttributeValues: {
            ":user_id": userId,
        }
    }).promise()

    return data.Items.map(record => record.group_id)
}

const run = async(event) => {
    const userId = await Auth.getUserId(event.requestContext.authorizer.claims)

    const user = await Auth.getUser(userId)

    const groups = await getJoinedGroups(userId)

    return {
        ...user,
        groups: groups,
    }
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
