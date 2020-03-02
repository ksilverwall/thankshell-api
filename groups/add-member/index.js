let Auth = require('thankshell-libs/auth.js');
let AWS = require("aws-sdk");

class AccessDeniedError extends Error {}
class ClientError extends Error {}

const setMember = async(dynamo, gid, members) => {
    await dynamo.update({
        TableName: process.env.GROUPS_TABLE_NAME,
        Key:{
            'group_id': gid,
        },
        UpdateExpression: 'set members = :members',
        ExpressionAttributeValues: {
            ':members': dynamo.createSet(members)
        }
    }).promise();
}

const loadMembers = async(dynamo, gid) => {
    const data = await dynamo.get({
        TableName: process.env.GROUPS_TABLE_NAME,
        Key:{
            'group_id': gid,
        },
    }).promise();

    return data.Item.members.values
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

const run = async(event) => {
   const dynamo = new AWS.DynamoDB.DocumentClient()
   const gid = event.pathParameters.group
   const target = event.pathParameters.member
   const userInfo = await Auth.getUserInfo(event.requestContext.authorizer.claims)

   if (!isAdmin(dynamo, gid, userInfo.userId)) {
       throw new AccessDeniedError()
   }

   let members = await loadMembers(dynamo, gid)
   if (members.includes(target)) {
       throw new ClientError(`'${target}' already registered`)
   }

   members.push(target)

   await setMember(dynamo, gid, members)

   return {}
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
        if (err instanceof AccessDeniedError) {
            return {
                statusCode: 403,
                headers: {"Access-Control-Allow-Origin": "*"},
                body: JSON.stringify({'message': '権限がありません'}),
            }
        } else if (err instanceof ClientError) {
            return {
                statusCode: 400,
                headers: {"Access-Control-Allow-Origin": "*"},
                body: JSON.stringify({'message': err.message}),
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
