// ভিডিও শেয়ার প্রিভিউ পেজ — প্রতিটা ভিডিওর জন্য আলাদা og:image (ভিডিওর থাম্বনেইল)
// তৈরি করে। টেলিগ্রাম/ফেসবুক/হোয়াটসঅ্যাপ লিঙ্কটা ক্রল করলে সাইটের লোগোর বদলে
// সেই ভিডিওর ছবি ও নাম দেখায়। ক্লিক করলে ভিডিওর ছবিসহ একটা পোস্টার পেজ খোলে এবং
// পেজটা "দেখুন" বাটনে চাপ দিলে টেলিগ্রাম মিনি অ্যাপের সেই ভিডিওতেই নিয়ে যায়।
//
// ব্যবহার: GET /api/video-share?v=<Firebase ভিডিও key>
const crypto = require('crypto');

/* প্লে বাটন টেলিগ্রাম মিনি অ্যাপের সরাসরি ঠিকানায় (startapp সহ) নিয়ে যায় —
   অ্যাপের ভেতরে সেই ভিডিওই খুলবে। নাম দুটো config.js-এর TELEGRAM_SHARE-এর
   সাথে হুবহু মিল রাখতে হবে (BotFather-এর অ্যাপ নামও একই)। */
const SHARE_BOT = 'secret0video_bot';
const SHARE_APP = 'httpstelegramsecretvideoal';

function miniAppLink(key) {
  return 'https://t.me/' + SHARE_BOT + '/' + SHARE_APP + '?startapp=v_' + String(key);
}

const DB_URL = 'https://telegram-secret-video-default-rtdb.firebaseio.com';
const SITE_LOGO = 'https://i.ibb.co/SDTwgBj6/1000109014.png';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ভিডিও লিঙ্ক থেকে অটো থাম্বনেইল (অ্যাপের autoGetThumbnail-এর সার্ভার সংস্করণ)
function autoThumb(videoUrl) {
  const url = String(videoUrl || '');
  let m = url.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (m) return 'https://img.youtube.com/vi/' + m[1] + '/hqdefault.jpg';
  m = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (m) return 'https://www.dailymotion.com/thumbnail/video/' + m[1];
  return '';
}

function pickThumbnail(item) {
  if (!item) return '';
  const manual = item.imgUrl || item.posterUrl || item.thumbnailUrl ||
    (item.episodes && item.episodes[0] ? item.episodes[0].thumbnailUrl : '');
  return String(manual || '').trim() || autoThumb(item.videoUrl);
}

async function fetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  return await r.json();
}

function pageHtml({ title, thumb, playLink, shareUrl, found, premium }) {
  const escTitle = escapeHtml(title);
  const escThumb = escapeHtml(thumb || '');
  const escPlay = escapeHtml(playLink || '/');
  const escUrl = escapeHtml(shareUrl);
  const desc = found
    ? '🎬 ভিডিওটি এখনই দেখুন — Secret Video Smoky'
    : '🎬 সব ভিডিও দেখতে Secret Video Smoky অ্যাপে আসুন';

  /* ভিডিওর ছবিসহ পোস্টার — ছবিটা স্থায়ীভাবে দেখা যায়, কোনো অটো-রিডাইরেক্ট নেই */
  const media = found
    ? (thumb
        ? `<div class="thumb-wrap"><img src="${escThumb}" alt="${escTitle}" onerror="this.closest('.thumb-wrap').classList.add('no-img'); this.remove();"><span class="play-badge">▶</span></div>`
        : `<div class="thumb-wrap no-img"><span class="play-badge">▶</span></div>`)
    : `<div class="thumb-wrap no-img logo"><img src="${escapeHtml(SITE_LOGO)}" alt="Secret Video Smoky" onerror="this.style.display='none';"></div>`;

  return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escTitle}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta property="og:type" content="video.other">
<meta property="og:site_name" content="Secret Video Smoky">
<meta property="og:title" content="${escTitle}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${thumb ? escThumb : escapeHtml(SITE_LOGO)}">
<meta property="og:image:width" content="720">
<meta property="og:image:height" content="720">
<meta property="og:url" content="${escUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escTitle}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${thumb ? escThumb : escapeHtml(SITE_LOGO)}">
<style>
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:radial-gradient(circle at 20% 10%, #1c1c2b 0%, #12121a 55%, #0d0d13 100%);
         color:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Hind Siliguri',sans-serif; }
  .wrap { text-align:center; padding:28px 20px; max-width:400px; width:100%; }
  .thumb-wrap { position:relative; max-width:340px; margin:0 auto 18px; border-radius:18px;
                overflow:hidden; background:#08080d; box-shadow:0 14px 44px rgba(0,0,0,.6);
                border:1px solid rgba(255,255,255,.08); }
  .thumb-wrap img { width:100%; display:block; }
  .thumb-wrap.no-img { aspect-ratio:16/10; display:flex; align-items:center; justify-content:center;
                       background:linear-gradient(135deg,#1b1b29,#101018); }
  .thumb-wrap.no-img.logo img { width:46%; max-width:150px; }
  .play-badge { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                width:60px; height:60px; border-radius:50%; background:rgba(229,9,20,.92);
                color:#fff; font-size:22px; display:flex; align-items:center; justify-content:center;
                padding-left:5px; box-shadow:0 6px 22px rgba(229,9,20,.45); }
  .thumb-wrap.no-img.logo .play-badge { display:none; }
  .badge { display:inline-block; background:linear-gradient(135deg,#f5a623,#e50914); color:#fff;
           font-size:11px; font-weight:800; letter-spacing:.5px; padding:5px 12px;
           border-radius:999px; margin-bottom:10px; }
  .wrap h1 { font-size:20px; margin:0 0 8px; line-height:1.4; }
  .wrap p { font-size:13px; color:#9aa0b4; margin:0 0 22px; line-height:1.5; }
  .btn { display:block; max-width:340px; margin:0 auto; background:linear-gradient(135deg,#e50914,#b00610);
         color:#fff; text-decoration:none; font-size:16px; font-weight:800; padding:15px 20px;
         border-radius:999px; box-shadow:0 8px 26px rgba(229,9,20,.4); }
  .btn:active { transform:scale(.98); }
  .foot { margin-top:20px; font-size:11px; color:#6b7180; letter-spacing:.4px; }
</style>
</head>
<body>
  <div class="wrap">
    ${media}
    ${found && premium ? '<span class="badge">★ প্রিমিয়াম ভিডিও</span>' : ''}
    <h1>${escTitle}</h1>
    <p>${found
      ? 'ভিডিওটি দেখতে নিচের বাটনে চাপ দিন 👇'
      : 'দুঃখিত, ভিডিওটি খুঁজে পাওয়া যায়নি। সব ভিডিও দেখতে অ্যাপে আসুন।'}</p>
    <a class="btn" href="${found ? escPlay : '/'}">${found ? '▶ এই ভিডিওটি দেখুন' : 'Secret Video Smoky অ্যাপটি খুলুন'}</a>
    <div class="foot">Secret Video Smoky</div>
  </div>
</body>
</html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=180');

  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const key = String((req.query && req.query.v) || '').trim();
  if (!key || !/^[A-Za-z0-9_-]{1,64}$/.test(key)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(pageHtml({
      title: 'Secret Video Smoky',
      thumb: '',
      playLink: '/',
      shareUrl: '',
      found: false,
      premium: false
    }));
  }

  /* প্লে বাটন টেলিগ্রাম মিনি অ্যাপের সরাসরি ঠিকানায় নিয়ে যায় — ক্লিক করলেই
     মিনি অ্যাপ খুলে অ্যাপের ভেতরে সেই ভিডিও খুলবে, বটের প্রোফাইলে যাবে না। */
  const playLink = miniAppLink(key);
  const shareUrl = `https://${String(req.headers.host || 'secret-video-smoky.vercel.app')}/?v=${encodeURIComponent(key)}`;

  // নরমাল ভিডিও → না পেলে প্রিমিয়াম ভিডিও
  let item = null, premium = false;
  try {
    item = await fetchJson(`${DB_URL}/videos/${key}.json`);
    if (!item) {
      item = await fetchJson(`${DB_URL}/premiumVideos/${key}.json`);
      premium = !!item;
    }
  } catch (e) { item = null; }

  const title = (item && (item.title || item.name)) ? String(item.title || item.name) : 'Secret Video Smoky 🎬';
  const thumb = pickThumbnail(item);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(pageHtml({
    title: title,
    thumb: thumb,
    playLink: playLink,
    shareUrl: shareUrl,
    found: !!item,
    premium: premium
  }));
};
