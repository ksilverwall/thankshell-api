const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const TransactionService = require('thankshell-libs/TransactionService.js');
const GroupDao = require('thankshell-libs/GroupDao.js');
const GroupMembersDao = require('thankshell-libs/GroupMembersDao.js');
const TransactionHistoryRepository = require('thankshell-libs/TransactionHistoryRepository.js');
const GroupMemberPermission = require('thankshell-libs/GroupMemberPermission.js');

const BANK_MEMBER_ID = '__BANK__';
const VOID_MEMBER_ID = '__VOID__';

const decode = (memberId) => {
  switch(memberId) {
    case BANK_MEMBER_ID: return 'sla_bank';
    case VOID_MEMBER_ID: return '--';
    default: return memberId;
  }
}

const convertToClassic = (record) => {
  return {
    "transaction_id": record['transaction_id'],
    "from_account": decode(record['from_member_id']),
    "to_account": decode(record['to_member_id']),
    "type": 'selan',
    "amount": record['amount'],
    "timestamp": record['timestamp'],
    "comment": record['comment'],
  };
}

const getTargetUserId = (params) => {
  if (params && params['user_id']) {
    return params['user_id'][0]
  } else {
    return null
  }
}

const run = async(event) => {
  try{
    const groupId = event.pathParameters.group;
    const claims = event.requestContext.authorizer.claims;
    const params = event.multiValueQueryStringParameters

    const transactionsService = new TransactionService(
      groupId,
      new GroupDao(),
      new GroupMembersDao(),
      new TransactionHistoryRepository(process.env.TOKEN_TRANSACTIONS_TABLE_NAME)
    ); 

    const authId = Auth.getAuthId(claims);
    const member = await (new GroupMembersDao()).findMemberByAuthIdAsync(groupId, authId);
    if(!member) {
      throw new appInterface.ApplicationError("user id not found", "MEMBER_NOT_FOUND", 403);
    }

    let history = null;
    const targetUser = getTargetUserId(params)
    if (!targetUser) {
      if (member.permission < GroupMemberPermission.ADMIN) {
        throw new appInterface.PermissionDeniedError("この取引を参照する権限がありません")
      }

      history = await transactionsService.getHistoryAsync();
    } else {
      history = await transactionsService.getMemberHistoryAsync(targetUser);
    }

    const items = history.map(record => convertToClassic(record));
    const result = {
        history: {
          Count: items.length,
          Items: items,
        },
    }

    return appInterface.getSuccessResponse(result);
  } catch(error) {
    console.log(err);
    return appInterface.getErrorResponse(err);
  }
};

exports.handler = async(event) => {
  return await run(event);
};
