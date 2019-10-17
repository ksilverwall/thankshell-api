let Auth = require('thankshell-libs/auth.js');
let AWS = require("aws-sdk");

async function getHistory(dynamo, account, stage) {
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

    let adminMode = false;

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
        let params;
        if(adminMode) {
            params = {
                TableName: tableName[stage]['data'],
                KeyConditionExpression: "block_id = :block",
                ExpressionAttributeValues: {
                    ":block": blockId
                }
            };
        } else {
            params = {
                TableName: tableName[stage]['data'],
                KeyConditionExpression: "block_id = :block",
                FilterExpression: "from_account = :account or to_account = :account",
                ExpressionAttributeValues: {
                    ":block": blockId,
                    ":account": account
                }
            };
        }

        var data = await dynamo.query(params).promise();
        history.Items = history.Items.concat(data.Items);
        history.Count += data.Count;
    }

    return history;
}

let getTransactions = async(userId, event) => {
    let dynamo = new AWS.DynamoDB.DocumentClient();

    let pathParameters = event.pathParameters
    let requestBody = JSON.parse(event.body)
    let stage = event.stageVariables.transaction_database

    userId = '--';
    let history = await getHistory(dynamo, userId, stage);
    let carried = 0;

    history.Items.forEach((item) => {
        if(item.from_account == userId) {
            carried += item.amount;
        }
        if(item.to_account == userId) {
            carried -= item.amount;
        }
    });

    return carried;
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
