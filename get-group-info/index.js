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

const Permission = {
    ADMIN: 'admin',
    MEMBER: 'member',
    VISITOR: 'visitor',
}

const getPermission = (userId, group) => {
    if (group.admins.values.includes(userId)) {
        return Permission.ADMIN
    }

    if (group.members.values.includes(userId)) {
        return Permission.MEMBER
    }

    return Permission.VISITOR
}

const run = async(event) => {
    const dynamo = new AWS.DynamoDB.DocumentClient()
    const groupId = event.pathParameters.group

    const userId = await Auth.getUserId(event.requestContext.authorizer.claims)
    const group = await getGroup(dynamo, groupId)

    if (!group) {
        throw new ApplicationError(`group '${groupId}' is not found`, 404)
    }

    const permission = getPermission(userId, group)
    const {owner, admins, requests, bank_id, members, secrets} = group

    const publicData = {
        group_id: groupId,
        permission: permission,
        owner: owner,
    }

    if (permission === Permission.VISITOR) {
        return publicData
    }

    const memberDetails = await getMemberDetails(members.values, secrets, (permission === Permission.ADMIN))

    return {
        ...publicData,
        admins: admins,
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
