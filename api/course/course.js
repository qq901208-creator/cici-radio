// api/course-detail.js
// Vercel serverless function - 為課程分享連結動態生成 OG meta tags
export default async function handler(req, res) {
  const id = req.query.id;
  const defaultTitle = '嘻嘻哪哩唷｜台灣喜劇課程講座';
  const defaultDesc = '提供全台喜劇相關課程與講座資訊，包含站立喜劇、即興、漫才等各式課程。';
  const defaultImg = 'https://cici-radio.vercel.app/assets/ciciradio.jpg';
  const siteUrl = 'https://cici-radio.vercel.app';

  let title = defaultTitle;
  let desc = defaultDesc;
  let img = defaultImg;
  let courseUrl = `${siteUrl}/course/${id}`;

  try {
    const projectId = 'cici-radio-e7902';
    const apiKey = 'AIzaSyDXW1OHmAAc8v2nbrhHYNPqmoCsUsc3RHw';
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/courses/${id}?key=${apiKey}`;
    const response = await fetch(firestoreUrl);
    if (response.ok) {
      const data = await response.json();
      const fields = data.fields || {};
      const name = fields.title?.stringValue || '';
      const date = fields.dateDisplay?.stringValue || fields.date?.stringValue || '';
      const location = fields.location?.stringValue || '';
      const fee = fields.fee?.stringValue || '';
      const description = fields.description?.stringValue || '';
      const imageUrl = fields.image?.stringValue || '';
      if (name) {
        title = `${name}｜嘻嘻哪哩唷`;
        const parts = [date, location, fee].filter(Boolean);
        desc = parts.join(' · ') + (description ? `\n${description.slice(0, 80)}` : '');
        img = imageUrl || defaultImg;
      }
    }
  } catch (e) {}

  const ua = req.headers['user-agent'] || '';
  const isCrawler = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|googlebot|bingbot|yandex|duckduckbot|applebot|linespider/i.test(ua);

  if (!isCrawler) {
    res.writeHead(302, { Location: `${siteUrl}/#courses?course=${id}` });
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
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${escapeHtml(img)}">
  <meta property="og:image:width" content="630">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${escapeHtml(courseUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="嘻嘻哪哩唷">
  <meta property="og:locale" content="zh_TW">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(desc)}">
  <meta name="twitter:image" content="${escapeHtml(img)}">
  <script>window.location.replace("${escapeHtml(siteUrl)}/#courses?course=${id}");</script>
</head>
<body>
  <p>正在載入 ${escapeHtml(title)}...</p>
  <a href="${escapeHtml(courseUrl)}">點此前往</a>
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
