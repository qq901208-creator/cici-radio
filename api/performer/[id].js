// api/performer/[id].js
// Vercel serverless function - 為演員分享連結動態生成 OG meta tags

export default async function handler(req, res) {
  const { id } = req.query;

  // 預設值
  const defaultTitle = '嘻嘻哪哩唷｜台灣喜劇演出資訊站';
  const defaultDesc = '提供全台 Stand-up Comedy、Open Mic、漫才、即興劇與喜劇專場資訊';
  const defaultImg = 'https://cici-radio.vercel.app/assets/ciciradio.jpg';
  const siteUrl = 'https://cici-radio.vercel.app';

  let title = defaultTitle;
  let desc = defaultDesc;
  let img = defaultImg;
  let performerUrl = `${siteUrl}/performer/${id}`;

  try {
    // 用 Firebase REST API 讀取演員資料（不需要 SDK）
    const projectId = 'cici-radio-e7902';
    const apiKey = 'AIzaSyDXW1OHmAAc8v2nbrhHYNPqmoCsUsc3RHw';
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/performers/${id}?key=${apiKey}`;

    const response = await fetch(firestoreUrl);
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

  // 判斷是否是爬蟲（爬蟲不執行 JS，一般用戶重導向到 SPA）
  const ua = req.headers['user-agent'] || '';
  const isCrawler = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|line-podcast|vkshare|googlebot|bingbot|yandex|duckduckbot|sogou|ia_archiver|facebot|outbrain|pinterest|applebot|curl|wget|python-requests/i.test(ua);

  if (!isCrawler) {
    // 一般用戶：重導向到 SPA，讓 JS 處理
    res.writeHead(302, { Location: `${siteUrl}/#performers?performer=${id}` });
    res.end();
    return;
  }

  // 爬蟲：回傳含 OG tags 的靜態 HTML
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

  <!-- 爬蟲看完就重導向 -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(performerUrl)}">
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
