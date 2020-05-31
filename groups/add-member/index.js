const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const GroupMembersDao = require('thankshell-libs/GroupMembersDao.js');

const run = async(event) => {
  const groupId = event.pathParameters.group;
  const memberId = event.pathParameters.member;

  const accessable = await Auth.isAccessableAsync(groupId, ['admins'], event.requestContext.authorizer.claims);
  if (!accessable) {
    throw new appInterface.PermissionDeniedError()
  }

  await (new GroupMembersDao()).addAsync(groupId, memberId);
};

exports.handler = async(event) => {
  try {
    await run(event);

    return appInterface.getSuccessResponse();
  } catch(err) {
    console.log(err);
    return appInterface.getErrorResponse(err);
  }
};
