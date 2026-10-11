const { createHmac, timingSafeEqual, randomUUID } = require('node:crypto');

function signQuote(fields) {
  const payload = Buffer.from(JSON.stringify({ ...fields, expires: Date.now() + 86400000 })).toString('base64url');
  const signature = createHmac('sha256', process.env.TOSS_SECRET_KEY).update(payload).digest('base64url');
  return payload + '.' + signature;
}
function verifyQuote(token, expected) {
  if (typeof token !== 'string' || token.length > 4096 || !process.env.TOSS_SECRET_KEY) return false;
  try {
    const [payload, signature] = token.split('.');
    const actual = createHmac('sha256', process.env.TOSS_SECRET_KEY).update(payload).digest();
    const provided = Buffer.from(signature, 'base64url');
    if (actual.length !== provided.length || !timingSafeEqual(actual, provided)) return false;
    const fields = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return fields.expires >= Date.now() && Object.keys(expected).every(k => fields[k] === expected[k]);
  } catch (e) { return false; }
}
function newOrderId() { return 'sazubara_' + randomUUID().replace(/-/g, ''); }
module.exports = { signQuote, verifyQuote, newOrderId };
