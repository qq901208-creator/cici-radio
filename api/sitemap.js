// api/sitemap.js
// 動態生成 sitemap.xml，包含所有演出和演員頁面

export default async function handler(req, res) {
  const siteUrl = 'https://cici-radio.vercel.app';
  const projectId = 'cici-radio-e7902';
  const apiKey = 'AIzaSyDXW1OHmAAc8v2nbrhHYNPqmoCsUsc3RHw';

  const urls = [
    { loc: siteUrl, priority: '1.0', changefreq: 'daily' },
    { loc: `${siteUrl}/#shows`, priority: '0.9', changefreq: 'daily' },
    { loc: `${siteUrl}/#performers`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${siteUrl}/#venues`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${siteUrl}/#opmic`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${siteUrl}/#courses`, priority: '0.6', changefreq: 'weekly' },
    { loc: `${siteUrl}/#about`, priority: '0.5', changefreq: 'monthly' },
  ];

  try {
    // 讀取所有演出
    const showsRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/shows?key=${apiKey}&pageSize=300`
    );
    if (showsRes.ok) {
      const data = await showsRes.json();
      const docs = data.documents || [];
      for (const doc of docs) {
        const id = doc.name.split('/').pop();
        const f = doc.fields || {};
        const status = f.status?.stringValue || 'published';
        const date = f.date?.stringValue || '';
        // 只收錄已發布且未過期的演出
        if (status === 'published' && date >= new Date().toISOString().slice(0, 10)) {
          urls.push({
            loc: `${siteUrl}/show/${id}`,
            priority: '0.8',
            changefreq: 'weekly',
            lastmod: new Date().toISOString().slice(0, 10),
          });
        }
      }
    }

    // 讀取所有演員
    const perfRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/performers?key=${apiKey}&pageSize=300`
    );
    if (perfRes.ok) {
      const data = await perfRes.json();
      const docs = data.documents || [];
      for (const doc of docs) {
        const id = doc.name.split('/').pop();
        const f = doc.fields || {};
        const status = f.status?.stringValue || 'published';
        if (status !== 'hidden') {
          urls.push({
            loc: `${siteUrl}/performer/${id}`,
            priority: '0.7',
            changefreq: 'weekly',
            lastmod: new Date().toISOString().slice(0, 10),
          });
        }
      }
    }
  } catch (e) {
    // 讀取失敗就只回傳靜態頁面
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <priority>${u.priority}</priority>
    <changefreq>${u.changefreq}</changefreq>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).send(xml);
}
