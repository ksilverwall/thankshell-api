const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const TransactionService = require('thankshell-libs/TransactionService.js');
const GroupDao = require('thankshell-libs/GroupDao.js');
const GroupMembersDao = require('thankshell-libs/GroupMembersDao.js');
const TransactionHistoryRepository = require('thankshell-libs/TransactionHistoryRepository.js');

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
  // FIXME: get from query
  const groupId = 'sla'
  const claims = event.requestContext.authorizer.claims;
  const userId = await Auth.getMemberIdAsync(groupId, Auth.getAuthId(claims));
  if (!userId) {
      throw new appInterface.ApplicationError('memberId is not found', 'MEMBER_ID_NOT_FOUND', 403)
  }

  const params = event.multiValueQueryStringParameters
  const targetUser = getTargetUserId(params)
  const transactionsDao = new TransactionService(
    groupId,
    new GroupDao(),
    new GroupMembersDao(),
    new TransactionHistoryRepository(process.env.TOKEN_TRANSACTIONS_TABLE_NAME)
  ); 

  let history = null;
  if (!targetUser) {
    if (!await Auth.isAccessableAsync(groupId, ['admins'], claims)) {
      throw new appInterface.PermissionDeniedError("この取引を参照する権限がありません")
    }

    history = await transactionsDao.getHistoryAsync();
  } else {
    history = await transactionsDao.getMemberHistoryAsync(targetUser);
  }

  const items = history.map(record => convertToClassic(record));
  return {
      history: {
        Count: items.length,
        Items: items,
      },
  }
};

exports.handler = async(event) => {
  try {
    const result = await run(event);

    return appInterface.getSuccessResponse(result);
  } catch(err) {
    console.log(err);
    return appInterface.getErrorResponse(err);
  }
};
