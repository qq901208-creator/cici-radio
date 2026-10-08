// api/performer/[id].js
// Vercel serverless function - 為演員分享連結動態生成 OG meta tags
// 與舊版的差異：id 驗證、先判斷爬蟲（一般使用者不再讀資料庫）、script 內網址用 JSON 序列化

const SITE_URL = 'https://cici-radio.vercel.app';
const PROJECT_ID = 'cici-radio-e7902';
const API_KEY = process.env.FIRESTORE_API_KEY || 'AIzaSyDXW1OHmAAc8v2nbrhHYNPqmoCsUsc3RHw';
// ID 只允許英數與 . _ ~ : -（舊資料的 ID 可能含點號等符號）；其他一律轉回首頁。斜線、問號、引號、空白、角括號都不允許
const ID_RE = /^[A-Za-z0-9._~:-]{1,128}$/;
const CRAWLER_RE = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|googlebot|bingbot|yandex|duckduckbot|applebot|linespider/i;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
const jsString = (s) => JSON.stringify(String(s)).replace(/</g, '\\u003c');

export default async function handler(req, res) {
  const id = String(req.query.id || '');
  if (!ID_RE.test(id)) {
    res.writeHead(302, { Location: SITE_URL });
    res.end();
    return;
  }

  const redirectUrl = `${SITE_URL}/#performers?performer=${id}`;
  const ua = req.headers['user-agent'] || '';

  // 一般使用者：直接轉到 SPA，讓前端 JS 處理（不讀資料庫）
  if (!CRAWLER_RE.test(ua)) {
    res.writeHead(302, { Location: redirectUrl });
    res.end();
    return;
  }

  const defaultTitle = '嘻嘻哪哩唷｜台灣喜劇演出資訊站';
  const defaultDesc = '提供全台 Stand-up Comedy、Open Mic、漫才、即興劇與喜劇專場資訊';
  const defaultImg = `${SITE_URL}/assets/ciciradio.jpg`;
  const performerUrl = `${SITE_URL}/performer/${id}`;

  let title = defaultTitle;
  let desc = defaultDesc;
  let img = defaultImg;

  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/performers/${encodeURIComponent(id)}?key=${API_KEY}`;
    const response = await fetch(firestoreUrl, { signal: AbortSignal.timeout(6000) });
    if (response.ok) {
      const data = await response.json();
      const fields = data.fields || {};
      const name = fields.name?.stringValue || '';
      const tagline = fields.tagline?.stringValue || '';
      const bio = fields.bio?.stringValue || '';
      const photoUrl = fields.photoUrl?.stringValue || '';

      if (name) {
        title = `${name} | 嘻嘻哪哩唷 台灣喜劇演出資訊站`;
        desc = tagline || bio?.slice(0, 100) || defaultDesc;
        img = photoUrl || defaultImg;
      }
    }
  } catch (e) {
    // 讀取失敗就用預設值
  }

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}">

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${escapeHtml(img)}">
  <meta property="og:image:width" content="630">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${escapeHtml(performerUrl)}">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="嘻嘻哪哩唷">
  <meta property="og:locale" content="zh_TW">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(desc)}">
  <meta name="twitter:image" content="${escapeHtml(img)}">

  <!-- 爬蟲看完後用 JS 跳轉（不用 meta refresh 避免無限循環） -->
  <script>window.location.replace(${jsString(redirectUrl)});</script>
</head>
<body>
  <p>正在載入 ${escapeHtml(title)}...</p>
  <a href="${escapeHtml(performerUrl)}">點此前往</a>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).send(html);
}
