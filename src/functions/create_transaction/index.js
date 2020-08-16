const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const TransactionService = require('thankshell-libs/TransactionService.js');
const GroupDao = require('thankshell-libs/GroupDao.js');
const GroupMembersDao = require('thankshell-libs/GroupMembersDao.js');
const TransactionHistoryRepository = require('thankshell-libs/TransactionHistoryRepository.js');
const GroupMemberPermission = require('thankshell-libs/GroupMemberPermission.js');

const BANK_MEMBER_ID = '__BANK__';
const VOID_MEMBER_ID = '__VOID__';

const encode = (oldMemberId) => {
  switch(oldMemberId) {
    case 'sla_bank': return BANK_MEMBER_ID;
    case '--': return VOID_MEMBER_ID;
    default: return oldMemberId;
  }
}

class Controller {
  constructor(groupId) {
    this.groupId = groupId;
    this.transactionService = new TransactionService(
      groupId,
      new GroupDao(),
      new GroupMembersDao(),
      new TransactionHistoryRepository(process.env.TOKEN_TRANSACTIONS_TABLE_NAME)
    );
  }

  async send(claims, fromMemberId, toMemberId, amount, comment, timestamp) {
    if (!fromMemberId || !toMemberId || !amount) {
      throw new appInterface.ApplicationError('パラメータが誤っています', 'ILLIGAL_PARAMETERS', 400)
    }

    const authId = Auth.getAuthId(claims);
    const member = await (new GroupMembersDao()).findMemberByAuthIdAsync(this.groupId, authId);

    if(!member) {
      throw new appInterface.ApplicationError('member is not found', 'MEMBER_ID_NOT_FOUND', 403)
    }

    if (member.permission < GroupMemberPermission.MEMBER || (member.permission < GroupMemberPermission.ADMIN && fromMemberId !== member.memberId)) {
      throw new appInterface.PermissionDeniedError("この取引を発行する権限がありません")
    }

    await this.transactionService.create(
      fromMemberId,
      toMemberId,
      parseInt(amount, 10),
      timestamp,
      comment ? comment : ''
    );
  }

  async publish(authId, amount, comment, timestamp) {
    if (!amount) {
      throw new appInterface.ApplicationError(
        "パラメータが誤っています",
        "ILLIGAL_PARAMETERS",
        403
      );
    }

    const member = await (new GroupMembersDao()).findMemberByAuthIdAsync(this.groupId, authId);
    if(!member) {
      throw new appInterface.ApplicationError("user id not found", "MEMBER_NOT_FOUND", 403);
    }
    if (member.permission < GroupMemberPermission.ADMIN) {
      throw new appInterface.PermissionDeniedError("この取引を発行する権限がありません");
    }

    await this.transactionService.publishAsync(
      parseInt(amount, 10),
      timestamp,
      comment ? comment : ''
    );
  }
}


const run = async(event) => {
  try {
    const pathParameters = event.pathParameters;
    const groupId = pathParameters['group'];
    const claims = event.requestContext.authorizer.claims;
    const body = JSON.parse(event.body);

    const controller = new Controller(groupId);

    switch(body.type) {
      case 'send': {
        const {fromMemberId, toMemberId, amount, comment} = body;
        const timestamp = +(new Date());

        await controller.send(claims, encode(fromMemberId), encode(toMemberId), amount, comment, timestamp);
        break;
      }
      case 'publish': {
        const {amount, comment} = body;
        const timestamp = +(new Date());
        const authId = Auth.getAuthId(claims);

        await controller.publish(authId, amount, comment, timestamp);
        break;
      }
    }

    return appInterface.getSuccessResponse();
  } catch(err) {
    console.log(err);
    return appInterface.getErrorResponse(err);
  }
};

exports.handler = async(event) => {
  return await run(event);
};
