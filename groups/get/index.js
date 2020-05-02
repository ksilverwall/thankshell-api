const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const AWS = require("aws-sdk");
const crypto = require('crypto');


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
    if (!userId || !group.members.values.includes(userId)) {
        return Permission.VISITOR
    }

    if (group.admins.values.includes(userId)) {
        return Permission.ADMIN
    }

    return Permission.MEMBER
}

const run = async(event) => {
    const dynamo = new AWS.DynamoDB.DocumentClient()
    const groupId = event.pathParameters.group
    const claims = event.requestContext.authorizer.claims

    const group = await getGroup(dynamo, groupId)
    if (!group) {
        throw new appInterface.ApplicationError(`group '${groupId}' is not found`, 404)
    }

    const userId = await Auth.getUserId(claims)
    const permission = getPermission(userId, group)

    console.log(`${userId} has ${permission} for ${groupId}`)

    const {owner, admins, requests, bank_id, members, secrets} = group

    const publicData = {
        groupId: groupId,
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
        memberId: userId,
        admins: admins,
        bankId: bank_id,
        bank_id: bank_id,
        members: members,
        memberDetails: memberDetails,
    }
}

const getApiResponse = (err) => {
    const body = {'message': err.message}
    return {
        statusCode: (err instanceof ApplicationError) ? err.statusCode : 500,
        headers: {"Access-Control-Allow-Origin": "*"},
        body: JSON.stringify(body),
    }
}

exports.handler = async(event, context, callback) => {
    try {
        const result = await run(event)

        return appInterface.getSuccessResponse(result)
    } catch(err) {
        console.error(err);

        return appInterface.getErrorResponse(err)
    }
}
