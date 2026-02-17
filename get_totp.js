const totp = require('./src/utils/totp');
const db = require('./src/utils/database');

try {
  db.init();
  const user = db.getUserByUsername('admin');
  
  if (user && user.totp_secret) {
    const secret = totp.decryptSecret(user.totp_secret);
    const code = totp.generateCurrentToken(secret);
    console.log(code);
  } else {
    console.log('ERROR: No TOTP configured');
  }
} catch(e) {
  console.error('ERROR:', e.message);
}
