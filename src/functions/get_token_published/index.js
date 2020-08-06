const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const TransactionService = require('thankshell-libs/TransactionService.js');
const GroupDao = require('thankshell-libs/GroupDao.js');
const GroupMembersDao = require('thankshell-libs/GroupMembersDao.js');
const TransactionHistoryRepository = require('thankshell-libs/TransactionHistoryRepository.js');


const run = async() => {
  const groupId = 'sla';
  const memberId = await Auth.getMemberIdAsync('sla', Auth.getAuthId(claims));
  if (!memberId) {
    throw new appInterface.ApplicationError('memberId is not found', 'MEMBER_ID_NOT_FOUND', 403);
  }

  const transactionService = new TransactionService(
    groupId,
    new GroupDao(),
    new GroupMembersDao(),
    new TransactionHistoryRepository(process.env.TOKEN_TRANSACTIONS_TABLE_NAME)
  );

  return await transactionService.getPublishedAsync();
}

exports.handler = async(event, context, callback) => {
  try {
    const result = await run(event);

    return appInterface.getSuccessResponse(result);
  } catch(err) {
    console.log(err);

    return appInterface.getErrorResponse(err);
  }
};
