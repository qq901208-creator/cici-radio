// api/guide.js
// Vercel serverless function - 為新手指引分享連結動態生成 OG meta tags
export default async function handler(req, res) {
  const siteUrl = 'https://cici-radio.vercel.app';
  const title = '第一次看喜劇嗎？｜嘻嘻哪哩唷 新手指引';
  const desc = '嘻嘻帶你四步驟搞定！認識現場喜劇、找到你的第一場、第一次常見問題，輕鬆踏出第一步。';
  const img = 'https://cici-radio.vercel.app/assets/ciciradio.jpg';
  const guideUrl = `${siteUrl}/guide`;

  const ua = req.headers['user-agent'] || '';
  const isCrawler = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|googlebot|bingbot|yandex|duckduckbot|applebot|linespider/i.test(ua);

  if (!isCrawler) {
    res.writeHead(302, { Location: `${siteUrl}/#guide` });
    res.end();
    return;
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
  <meta property="og:url" content="${escapeHtml(guideUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="嘻嘻哪哩唷">
  <meta property="og:locale" content="zh_TW">
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(desc)}">
  <meta name="twitter:image" content="${escapeHtml(img)}">
  <script>window.location.replace("${escapeHtml(siteUrl)}/#guide");</script>
</head>
<body>
  <p>正在載入 ${escapeHtml(title)}...</p>
  <a href="${escapeHtml(guideUrl)}">點此前往</a>
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
