const Auth = require('thankshell-libs/auth.js');
const appInterface = require('thankshell-libs/interface.js');
const TransactionsDao = require('thankshell-libs/TransactionsDao.js');
const AWS = require("aws-sdk");


const run = async() => {
  const memberId = await Auth.getMemberIdAsync('sla', Auth.getAuthId(claims));
  if (!memberId) {
    throw new appInterface.ApplicationError('memberId is not found', 'MEMBER_ID_NOT_FOUND', 403);
  }

  const transactionsDao = new TransactionsDao();

  return await transactionsDao.getPublishedAsync();
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
