// api/show/[id].js
// Vercel serverless function - 為演出分享連結動態生成 OG meta tags

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) {
    res.status(400).send('Missing id');
    return;
  }

  const defaultTitle = '嘻嘻哪哩唷｜台灣喜劇演出資訊站';
  const defaultDesc = '提供全台 Stand-up Comedy、Open Mic、漫才、即興劇與喜劇專場資訊';
  const defaultImg = 'https://cici-radio.vercel.app/assets/ciciradio.jpg';
  const siteUrl = 'https://cici-radio.vercel.app';
  const showUrl = `${siteUrl}/show/${id}`;
  const redirectUrl = `${siteUrl}/#shows?show=${id}`;

  let title = defaultTitle;
  let desc = defaultDesc;
  let img = defaultImg;

  try {
    const projectId = 'cici-radio-e7902';
    const apiKey = 'AIzaSyDXW1OHmAAc8v2nbrhHYNPqmoCsUsc3RHw';
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/shows/${id}?key=${apiKey}`;

    const response = await fetch(firestoreUrl);
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

  // 明確爬蟲才回傳 OG HTML，其他重導向
  const ua = req.headers['user-agent'] || '';
  const isCrawler = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|googlebot|bingbot|yandex|duckduckbot|applebot|linespider/i.test(ua);

  if (!isCrawler) {
    res.writeHead(302, { Location: redirectUrl });
    res.end();
    return;
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
  <script>window.location.replace("${redirectUrl}");</script>
</head>
<body>
  <p>正在載入 ${e(title)}...</p>
  <a href="${redirectUrl}">點此前往</a>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
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
