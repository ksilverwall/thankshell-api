const Auth = require('thankshell-libs/auth.js');

const run = async(event) => {
    const userId = await Auth.getUserId(event.requestContext.authorizer.claims)

    return await Auth.getUser(userId)
};

exports.handler = async (event, context, callback) => {
    try {
        const result = await run(event);

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
                "message": err.message,
            }),
        };
    }
};
