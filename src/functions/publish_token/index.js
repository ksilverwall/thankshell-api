const Auth = require('thankshell-libs/auth.js');
const TokenController = require('thankshell-libs/TokenController.js');
const appInterface = require('thankshell-libs/interface.js');


const run = async(event) => {
    const groupId = 'sla';
    const token = event.pathParameters.token;
    const body = JSON.parse(event.body);
    const authId = Auth.getAuthId(event.requestContext.authorizer.claims);

    await (new TokenController(groupId)).publishAsync(authId, body.amount, body.comment);
};

exports.handler = async(event) => {
  try {
    await run(event);

    return appInterface.getSuccessResponse();
  } catch(err) {
    console.error(err);

    return appInterface.getErrorResponse(err);
  }
};
