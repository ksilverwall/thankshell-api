const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const TransactionsDao = require('thankshell-libs/TransactionsDao.js');
const AWS = require("aws-sdk");


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
  const transactionsDao = new TransactionsDao(); 
  let history = [];
  if (!targetUser) {
    if (!await Auth.isAccessableAsync(groupId, ['admins'], claims)) {
      throw new appInterface.PermissionDeniedError("この取引を参照する権限がありません")
    }

    history = await transactionsDao.getHistoryAsync();
  } else {
    history = await transactionsDao.getMemberHistoryAsync(targetUser);
  }

  return {
      history: history,
  }
};

exports.handler = async(event, context, callback) => {
  try {
    const result = await run(event);

    return appInterface.getSuccessResponse(result);
  } catch(err) {
    console.log(err);
    return appInterface.getErrorResponse(err);
  }
};
