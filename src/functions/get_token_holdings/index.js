const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const TransactionService = require('thankshell-libs/TransactionService.js');
const GroupDao = require('thankshell-libs/GroupDao.js');
const GroupMembersDao = require('thankshell-libs/GroupMembersDao.js');
const TransactionHistoryRepository = require('thankshell-libs/TransactionHistoryRepository.js');

const BANK_MEMBER_ID = '__BANK__';
const VOID_MEMBER_ID = '__VOID__';

const encode = (oldMemberId) => {
  switch(oldMemberId) {
    case 'sla_bank': return BANK_MEMBER_ID;
    case '--': return VOID_MEMBER_ID;
    default: return oldMemberId;
  }
}

const run = async(event) => {
  try {
    const groupId = event.pathParameters.group;
    const userId = await Auth.getMemberIdAsync(groupId, Auth.getAuthId(event.requestContext.authorizer.claims));
    if (!userId) {
      throw new appInterface.ApplicationError("user id not found", "MEMBER_NOT_FOUND", 400);
    }

    const dao = new TransactionService(
      groupId,
      new GroupDao(),
      new GroupMembersDao(),
      new TransactionHistoryRepository(process.env.TOKEN_TRANSACTIONS_TABLE_NAME)
    );

    let result = await dao.getAccountHoldingAsync(encode(userId));

    return appInterface.getSuccessResponse(result);
  } catch(err) {
    console.error(err);

    return appInterface.getErrorResponse(err);
  }
};

exports.handler = async(event) => {
    return await run(event);
};
