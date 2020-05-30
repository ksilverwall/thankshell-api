const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const UserController = require('thankshell-libs/UserController.js');


const run = async(event) => {
  const authId = Auth.getAuthId(event.requestContext.authorizer.claims);

  return await (new UserController(authId)).getAsync();
};

exports.handler = async(event) => {
  try {
    const result = await run(event);

    return appInterface.getSuccessResponse(result);
  } catch(err) {
    console.error(err);

    return appInterface.getErrorResponse(err);
  }
};
