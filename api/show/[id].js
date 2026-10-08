// api/show/[id].js
// Vercel serverless function - 為演出分享連結動態生成 OG meta tags
//
// 與舊版的差異（資安與用量）：
//  1. id 只接受英數、底線、連字號（舊版直接把 id 放進 <script> 與網址，可被塞入程式碼）
//  2. 先判斷是不是爬蟲：一般使用者點分享連結，立刻轉址，不再先讀一次 Firestore（舊版每次點擊都會讀 1 次）
//  3. 放進 <script> 的網址用 JSON 序列化

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
// 放進 <script> 的字串：JSON 序列化，並把 < 轉成 \u003c，避免提早結束 script 標籤
const jsString = (s) => JSON.stringify(String(s)).replace(/</g, '\\u003c');

export default async function handler(req, res) {
  const id = String(req.query.id || '');
  if (!ID_RE.test(id)) {
    res.writeHead(302, { Location: SITE_URL });
    res.end();
    return;
  }

  const redirectUrl = `${SITE_URL}/#shows?show=${id}`;
  const ua = req.headers['user-agent'] || '';

  // 一般使用者：直接轉址，不讀資料庫
  if (!CRAWLER_RE.test(ua)) {
    res.writeHead(302, { Location: redirectUrl });
    res.end();
    return;
  }

  const defaultTitle = '嘻嘻哪哩唷｜台灣喜劇演出資訊站';
  const defaultDesc = '提供全台 Stand-up Comedy、Open Mic、漫才、即興劇與喜劇專場資訊';
  const defaultImg = `${SITE_URL}/assets/ciciradio.jpg`;
  const showUrl = `${SITE_URL}/show/${id}`;

  let title = defaultTitle;
  let desc = defaultDesc;
  let img = defaultImg;

  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/shows/${encodeURIComponent(id)}?key=${API_KEY}`;
    const response = await fetch(firestoreUrl, { signal: AbortSignal.timeout(6000) });
    if (response.ok) {
      const data = await response.json();
      const f = data.fields || {};
      const showTitle = f.title?.stringValue || '';
      const date = f.date?.stringValue || '';
      const venue = f.venueLabel?.stringValue || f.venue?.stringValue || '';
      const performer = f.performer?.stringValue || '';
      const image = f.image?.stringValue || '';

      if (showTitle) {
        title = `${showTitle} | 嘻嘻哪哩唷`;
        const parts = [];
        if (date) parts.push(date.replace(/-/g, '/'));
        if (venue) parts.push(venue);
        if (performer) parts.push(performer);
        desc = parts.join(' · ') || defaultDesc;
        img = image || defaultImg;
      }
    }
  } catch (e) {
    // 讀取失敗用預設值
  }

  const e = escapeHtml;
  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e(title)}</title>
  <meta name="description" content="${e(desc)}">
  <meta property="og:title" content="${e(title)}">
  <meta property="og:description" content="${e(desc)}">
  <meta property="og:image" content="${e(img)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${e(showUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="嘻嘻哪哩唷">
  <meta property="og:locale" content="zh_TW">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${e(title)}">
  <meta name="twitter:description" content="${e(desc)}">
  <meta name="twitter:image" content="${e(img)}">
  <script>window.location.replace(${jsString(redirectUrl)});</script>
</head>
<body>
  <p>正在載入 ${e(title)}...</p>
  <a href="${e(redirectUrl)}">點此前往</a>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
  res.status(200).send(html);
}
