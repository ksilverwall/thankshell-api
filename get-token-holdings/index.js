const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const TransactionsDao = require('thankshell-libs/TransactionsDao.js');

const run = async(event) => {
  const groupId = 'sla';
  const userId = await Auth.getMemberIdAsync(groupId, Auth.getAuthId(event.requestContext.authorizer.claims));
  if (!userId) {
    throw new appInterface.ApplicationError("user id not found", "MEMBER_NOT_FOUND", 400);
  }

  const dao = new TransactionsDao(groupId);

  return await dao.getAccountHoldingAsync(userId);
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
