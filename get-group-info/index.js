const Auth = require('thankshell-libs/auth.js');
const AWS = require("aws-sdk");
const crypto = require('crypto');

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

const getHash = (message) => {
    return crypto.createHash('sha256').update(message).digest('hex')
}

const getMemberDetails = async(memberIds, secrets, adminUser) => {
    const allMembers = await Promise.all(memberIds.map(userId => Auth.getUser(userId)))

    let dict = {}
    allMembers.forEach(user => {
        const userId = user.user_id
        const data = {
            state: user.status,
            displayName: user.displayName,
        }
        if (user.status === 'UNREGISTERED') {
            data.linkParams = {
                m: userId,
                hash: getHash(userId + secrets),
            }
        }

        dict[userId] = data
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

    const {owner, admins, group_id, requests, bank_id, members, secrets} = group

    if (!members.values.includes(userId)) {
        throw new ApplicationError('user is not a member', 403)
    }

    const adminUser = admins.values.includes(userId)
    const memberDetails = await getMemberDetails(members.values, secrets, adminUser)

    return {
        owner: owner,
        admins: admins,
        group_id: group_id,
        requests: requests,
        bank_id: bank_id,
        members: members,
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
