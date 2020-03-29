const Auth = require('thankshell-libs/auth.js');
const AWS = require("aws-sdk");

class ApplicationError extends Error {
  constructor(message, code=500) {
    super(message)
    this.code = code
  }
}

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

    if (!group) {
        throw new ApplicationError(`group '${groupId}' is not found`, 404)
    }

    if (!group.members.values.includes(userId)) {
        throw new ApplicationError('user is not a member', 403)
    }

    const memberDetails = await getMemberDetails(group.members.values)
    return {
        ...group,
        memberDetails: memberDetails,
    }
}

const getApiResponse = (code, body) => {
    return {
        statusCode: code,
        headers: {"Access-Control-Allow-Origin": "*"},
        body: JSON.stringify(body),
    }
}

exports.handler = async(event, context, callback) => {
    try {
        const result = await run(event)
        return getApiResponse(200, result)
    } catch(err) {
        console.log(err);
        return getApiResponse(
            (err instanceof ApplicationError) ? err.code : 500,
            {'message': err.message}
        )
    }
}
