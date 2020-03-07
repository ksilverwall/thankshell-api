const Auth = require('thankshell-libs/auth.js');
const AWS = require("aws-sdk");

const getGroup = async(dynamo, groupId) => {
    const result = await dynamo.get({
        TableName: process.env.GROUPS_TABLE_NAME,
        Key:{
            'group_id': groupId,
        },
    }).promise()

    return result.Item
}

const getMemberDetails = async(memberIds) => {
    const allMembers = await Promise.all(memberIds.map(userId => Auth.getUser(userId)))

    let dict = {}
    allMembers.forEach(user => {
        if (user.status === 'ENABLE') {
            dict[user.user_id] = {displayName: user.displayName}
        }
    })

    return dict
}
const run = async(event) => {
    const dynamo = new AWS.DynamoDB.DocumentClient()
    const groupId = event.pathParameters.group

    const userId = await Auth.getUserId(event.requestContext.authorizer.claims)
    const group = await getGroup(dynamo, groupId)

    if (!group.members.values.includes(userId)) {
        new Error('user is not a member')
    }

    const memberDetails = await getMemberDetails(group.members.values)
    return {
        ...group,
        memberDetails: memberDetails,
    }
}

exports.handler = async(event, context, callback) => {
    try {
        const result = await run(event)
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
                'message': err.message,
            }),
        }
    }
}
