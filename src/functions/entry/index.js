const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const GroupMembersDao = require('thankshell-libs/GroupMembersDao.js');

const run = async(event) => {
  const groupId = event.pathParameters.group
  const claims = event.requestContext.authorizer.claims
  const body = JSON.parse(event.body);
  const {memberId} = body;

  console.log(`clains: ${JSON.stringify(claims)}`)

  await (new GroupMembersDao()).entryAsync(groupId, memberId, Auth.getAuthId(claims))
}

exports.handler = async(event) => {
  try {
    await run(event);

    return appInterface.getSuccessResponse();
  } catch(err) {
    console.log(err);
    return appInterface.getErrorResponse(err);
  }
};
