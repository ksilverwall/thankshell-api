let Auth = require('thankshell-libs/auth.js');
let AWS = require("aws-sdk");

let getHistory = async(dynamo, account, stage) => {
    let tableName = {
        'production': {
            'info': 'table_info',
            'data': 'remittance_transactions',
        },
        'develop': {
            'info': 'dev_table_info',
            'data': 'dev_remittance_transactions',
        },
    };

    let history = {
        Count: 0,
        Items: []
    };

    let tableInfo = await dynamo.get({
        TableName: tableName[stage]['info'],
        Key:{
            'name': tableName[stage]['data'],
        }
    }).promise();

    let maxBlockId = tableInfo.Item ? Math.floor(tableInfo.Item.current_id_sequence / 1000) : 0;

    for (let blockId=maxBlockId; blockId >= 0; --blockId) {
        let params = {
            TableName: tableName[stage]['data'],
            KeyConditionExpression: "block_id = :block",
            FilterExpression: "from_account = :account or to_account = :account",
            ExpressionAttributeValues: {
                ":block": blockId,
                ":account": account
            }
        };

        let data = await dynamo.query(params).promise();

        history.Items = history.Items.concat(data.Items);
        history.Count += data.Count;
    }

    return history;
};

let getAllHistory = async(dynamo, stage) => {
    let tableName = {
        'production': {
            'info': 'table_info',
            'data': 'remittance_transactions',
        },
        'develop': {
            'info': 'dev_table_info',
            'data': 'dev_remittance_transactions',
        },
    };

    let history = {
        Count: 0,
        Items: []
    };

    let tableInfo = await dynamo.get({
        TableName: tableName[stage]['info'],
        Key:{
            'name': tableName[stage]['data'],
        }
    }).promise();

    let maxBlockId = tableInfo.Item ? Math.floor(tableInfo.Item.current_id_sequence / 1000) : 0;

    for (let blockId=maxBlockId; blockId >= 0; --blockId) {
        let params = {
            TableName: tableName[stage]['data'],
            KeyConditionExpression: "block_id = :block",
            ExpressionAttributeValues: {
                ":block": blockId
            }
        };

        let data = await dynamo.query(params).promise();

        history.Items = history.Items.concat(data.Items);
        history.Count += data.Count;
    }

    return history;
};

let isAdmin = async(dynamo, groupId, userId) => {
    let data = await dynamo.get({
        TableName: process.env.GROUPS_TABLE_NAME,
            Key:{
                'group_id': groupId,
            }
    }).promise();

    return data.Item.admins.values.includes(userId);
};

let getTransactions = async(userId, event) => {
    let dynamo = new AWS.DynamoDB.DocumentClient();

    let stage = event.stageVariables.transaction_database

    let history;
    if (event.multiValueQueryStringParameters && event.multiValueQueryStringParameters['user_id']) {
        let targetUser = event.multiValueQueryStringParameters['user_id'][0];
        history = await getHistory(dynamo, targetUser, stage);
    } else {
        if (!await isAdmin(dynamo, 'sla', userId)) {
            throw Error("管理者権限ではありません");
        }
        history = await getAllHistory(dynamo, stage);
    }

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

    return {
        history: history,
        carried: carried
    };
};

exports.handler = async(event, context, callback) => {
    let statusCode = 200;
    let data;

    try {
        let userId = await Auth.getUserId(event.requestContext.authorizer.claims);
        if (userId) {
            statusCode = 200;
            data = await getTransactions(userId, event);
        } else {
            statusCode = 403;
            data = {
                "message": "user id not found",
            };
        }
    } catch(err) {
        console.log(err);

        statusCode = 500;
        data = {
            'message': err.message,
        };
    }

    return {
        statusCode: statusCode,
        headers: {"Access-Control-Allow-Origin": "*"},
        body: JSON.stringify(data),
    };
};
