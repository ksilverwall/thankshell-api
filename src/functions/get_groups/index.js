const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const GroupController = require('thankshell-libs/GroupController.js');

const run = async(event) => {
  const groupId = event.pathParameters.group;
  const authId = Auth.getAuthId(event.requestContext.authorizer.claims);

  return await (new GroupController()).get(authId, groupId);
};

exports.handler = async(event, context, callback) => {
  try {
    const result = await run(event)

    return appInterface.getSuccessResponse(result)
  } catch(err) {
    console.error(err);

    return appInterface.getErrorResponse(err)
  }
};
