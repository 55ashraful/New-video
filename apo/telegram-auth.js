const crypto = require('crypto');

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function verifyTelegramInitData(initData, botToken) {
  if (!initData || typeof initData !== 'string' || initData.length > 10000) throw new Error('Missing Telegram initData');
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new Error('Telegram hash missing');
  params.delete('hash');
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (!safeEqual(calculatedHash, receivedHash)) throw new Error('Telegram data signature is invalid');
  const authDate = Number(params.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || now - authDate > 86400 || authDate > now + 60) throw new Error('Telegram login data expired');
  const raw = params.get('user');
  if (!raw) throw new Error('Telegram user information missing');
  const user = JSON.parse(raw);
  if (!user || !user.id) throw new Error('Invalid Telegram user');
  return user;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN || '9188761308:AAGjsCjFuQe-qlgq0t3MeDTl5LAHwsLVBRY';
    if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN is not configured in Vercel' });
    const user = verifyTelegramInitData(req.body && req.body.initData, token);
    return res.status(200).json({ verified: true, user: {
      id: String(user.id), first_name: user.first_name || '', last_name: user.last_name || '',
      username: user.username || '', photo_url: user.photo_url || '', language_code: user.language_code || ''
    }});
  } catch (error) {
    const status = /Missing Telegram|Telegram hash|signature|expired|user information|Invalid Telegram/.test(error.message) ? 401 : 500;
    return res.status(status).json({ error: error.message || 'Telegram authentication failed' });
  }
};
