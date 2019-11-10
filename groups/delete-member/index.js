let Auth = require('thankshell-libs/auth.js');
let AWS = require("aws-sdk");

class AccessDeniedError extends Error {}

class Group {
    constructor(gid, members) {
        this.gid = gid
        this.members = members
    }

    async deleteMember(dynamo, gid, target) {
        this.members = this.members.values.filter(uid => uid != target)

        await dynamo.update({
            TableName: process.env.GROUPS_TABLE_NAME,
            Key:{
                'group_id': gid,
            },
            UpdateExpression: 'set members = :members',
            ExpressionAttributeValues: {
                ':members': dynamo.createSet(this.members)
            }
        }).promise();
    }

    static async load(dynamo, gid) {
        const data = await dynamo.get({
            TableName: process.env.GROUPS_TABLE_NAME,
            Key:{
                'group_id': gid,
            },
        }).promise();

        return new Group(gid, data.Item.members)
    }
}

const isAdmin = async(dynamo, groupId, userId) => {
    let data = await dynamo.get({
        TableName: process.env.GROUPS_TABLE_NAME,
            Key:{
                'group_id': groupId,
            }
    }).promise();

    return data.Item.admins.values.includes(userId);
}

const deleteMember = async(event) => {
    const dynamo = new AWS.DynamoDB.DocumentClient();

    const userInfo = await Auth.getUserInfo(event.requestContext.authorizer.claims);
    const gid = event.pathParameters.group;
    const target = event.pathParameters.member;

    const group = await Group.load(dynamo, gid)

    if (!isAdmin(dynamo, gid, userInfo.userId)) {
        throw new AccessDeniedError()
    }

    await group.deleteMember(dynamo, gid, target)

    return {}
}

exports.handler = async(event, context, callback) => {
    try {
        let result = await deleteMember(event);
        return {
            statusCode: 200,
            headers: {"Access-Control-Allow-Origin": "*"},
            body: JSON.stringify(result),
        };
    } catch(err) {
        console.log(err);
        if (err instanceof AccessDeniedError) {
            return {
                statusCode: 403,
                headers: {"Access-Control-Allow-Origin": "*"},
                body: JSON.stringify({'message': '権限がありません'}),
            }
        } else {
            return {
                statusCode: 500,
                headers: {"Access-Control-Allow-Origin": "*"},
                body: JSON.stringify({'message': err.message}),
            }
        }
    }
}
