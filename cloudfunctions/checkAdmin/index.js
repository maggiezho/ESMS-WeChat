const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { password } = event
  const ADMIN_PASSWORD = '123456' 

  if (password === ADMIN_PASSWORD) {
    return { success: true }
  } else {
    return { success: false }
  }
}