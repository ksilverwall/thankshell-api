const appInterface = require('thankshell-libs/interface.js');

exports.handler = async() => {
  try {
    throw new appInterface.ApplicationError("Aborted api")
  } catch(err) {
    console.log(err);

    return appInterface.getErrorResponse(err)
  }
}
