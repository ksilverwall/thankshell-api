const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const GroupMembersDao = require('thankshell-libs/GroupMembersDao.js');


const run = async(event) => {
  console.log(`EventBody: ${event.body}`);
  console.log(`PathParameter: ${event.pathParameters}`);

  const groupId = event.pathParameters.group;
  const userId = event.pathParameters.userId
  const authId = Auth.getAuthId(event.requestContext.authorizer.claims);
  const member = JSON.parse(event.body)

  if (!userId) {
    throw new appInterface.ApplicationError(
      "userId is not set in path parameters",
      "INVALID_PARAMTER",
      400
    );
  }

  await (new GroupMembersDao()).updateAsync(groupId, authId, userId, member);
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
