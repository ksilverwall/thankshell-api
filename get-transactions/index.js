const Auth = require('thankshell-libs/auth.js');
const AWS = require("aws-sdk");

const getHistory = async(dynamo, info_table_name, data_table_name, account) => {
    const tableInfo = await dynamo.get({
        TableName: info_table_name,
        Key:{
            'name': data_table_name,
        }
    }).promise()

    const maxBlockId = tableInfo.Item ? Math.floor(tableInfo.Item.current_id_sequence / 1000) : 0

    let history = {
        Count: 0,
        Items: [],
    }

    for (let blockId=maxBlockId; blockId >= 0; --blockId) {
        const data = await dynamo.query(
            account ? {
                TableName: data_table_name,
                KeyConditionExpression: "block_id = :block",
                FilterExpression: "from_account = :account or to_account = :account",
                ExpressionAttributeValues: {
                    ":block": blockId,
                    ":account": account
                }
            } : {
                TableName: data_table_name,
                KeyConditionExpression: "block_id = :block",
                ExpressionAttributeValues: {
                    ":block": blockId
                }
            }
        ).promise()

        history.Items = history.Items.concat(data.Items)
        history.Count += data.Count
    }

    return history
}

const isAdmin = async(dynamo, groupId, userId) => {
    const data = await dynamo.get({
        TableName: process.env.GROUPS_TABLE_NAME,
            Key:{
                'group_id': groupId,
            }
    }).promise()

    return data.Item.admins.values.includes(userId)
}

const getHoldings = async(history, userId) => {
    let carried = 0;
    history.Items.forEach((item) => {
        if(isFinite(item.amount)) {
            if(item.from_account == userId) {
                carried -= item.amount;
            }
            if(item.to_account == userId) {
                carried += item.amount;
            }
        }
    });

    return carried
}

const getTargetUserId = (params) => {
    if (params && params['user_id']) {
        return params['user_id'][0]
    } else {
        return null
    }
}

const run = async(event) => {
    const dynamo = new AWS.DynamoDB.DocumentClient()

    const info_table_name = process.env.TABLE_INFO_TABLE_NAME
    const data_table_name = process.env.REMITTANCE_TRANSACTIONS

    const params = event.multiValueQueryStringParameters
    const userId = await Auth.getUserId(event.requestContext.authorizer.claims);
    if (!userId) {
        throw new Error('user id not found')
    }

    // FIXME: get from query
    const groupId = 'sla'

    const targetUser = getTargetUserId(params)
    if (!targetUser) {
        if (!await isAdmin(dynamo, groupId, userId)) {
            throw Error("管理者権限ではありません");
        }
    }

    const history = await getHistory(dynamo, info_table_name, data_table_name, targetUser)

    return {
        history: history,
        carried: await getHoldings(history, userId),
    }
}

exports.handler = async(event, context, callback) => {
    try {
        const data = await run(event)
        return {
            statusCode: 200,
            headers: {"Access-Control-Allow-Origin": "*"},
            body: JSON.stringify(data),
        }
    } catch(err) {
        console.log(err)

        return {
            statusCode: 500,
            headers: {"Access-Control-Allow-Origin": "*"},
            body: JSON.stringify({
                'message': err.message,
            }),
        }
    }
}
