const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const TransactionService = require('thankshell-libs/TransactionService.js');
const GroupDao = require('thankshell-libs/GroupDao.js');
const GroupMembersDao = require('thankshell-libs/GroupMembersDao.js');
const TransactionHistoryRepository = require('thankshell-libs/TransactionHistoryRepository.js');


const run = async(event) => {
  const groupId = 'sla';
  const claims = event.requestContext.authorizer.claims;
  const userId = await Auth.getMemberIdAsync('sla', Auth.getAuthId(claims));
  if(!userId) {
    throw new appInterface.ApplicationError('memberId is not found', 'MEMBER_ID_NOT_FOUND', 403)
  }

  const body = JSON.parse(event.body);

  if (!body.from || !body.to || !body.amount) {
    throw new appInterface.ApplicationError('パラメータが誤っています', 'ILLIGAL_PARAMETERS', 400)
  }

  if (!await Auth.isAccessableAsync(groupId, ['admins'], claims)) {
    if (await Auth.isAccessableAsync(groupId, ['members'], claims)) {
      if(body.from !== userId) {
        throw new appInterface.PermissionDeniedError("この取引を発行する権限がありません")
      }
    } else {
      throw new appInterface.PermissionDeniedError("この取引を発行する権限がありません")
    }
  }

  let transaction = {
    "token": 'selan',
    "from": body.from,
    "to": body.to,
    "amount": parseInt(body.amount, 10),
  };

  if (body.comment) {
    transaction.comment = body.comment;
  }

  const dao = new TransactionService(
    groupId,
    new GroupDao(),
    new GroupMembersDao(),
    new TransactionHistoryRepository(process.env.TOKEN_TRANSACTIONS_TABLE_NAME)
  );
  await dao.create(groupId, transaction);
};

exports.handler = async(event) => {
  try {
    const result = await run(event);

    return appInterface.getSuccessResponse();
  } catch(err) {
    console.log(err);
    return appInterface.getErrorResponse(err);
  }
};

