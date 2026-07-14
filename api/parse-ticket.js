// /api/parse-ticket.js
// 伺服器端解析售票網站活動頁面（取代前端公用 CORS 代理，避免讀取失敗）
// 支援：KKTIX、Accupass、OPENTIX
// 用法：POST { url: "https://kktix.com/events/xxxx" }
// 回傳：{ ok:true, platform, title, date, time, image, desc } 或 { ok:false, error }

const ALLOWED_HOSTS = [
  'kktix.cc', 'kktix.com',
  'accupass.com', 'www.accupass.com',
  'opentix.life', 'www.opentix.life',
];

function detectPlatform(url) {
  if (url.includes('kktix')) return 'kktix';
  if (url.includes('accupass')) return 'accupass';
  if (url.includes('opentix')) return 'opentix';
  return 'other';
}

// 與前端舊版 extractMeta 邏輯相同，只是搬到伺服器端執行
function extractMeta(html) {
  const gm = (prop) => {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m) return m[1].replace(/&amp;/g, '&').trim();
    }
    return '';
  };

  let title = gm('og:title');
  if (!title) {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m) title = m[1].trim();
  }

  const image = gm('og:image');
  const desc = gm('og:description');

  const searchText = `${title} ${desc} ${html.slice(0, 8000)}`;
  const dateMatch = searchText.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  const date = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
    : '';

  const timeMatch = searchText.match(/(\d{1,2}):(\d{2})/);
  const time = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '';

  return { title, image, desc, date, time };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    res.status(400).json({ ok: false, error: '缺少網址' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ ok: false, error: '網址格式錯誤' });
    return;
  }

  const isAllowed = ALLOWED_HOSTS.some(
    (h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h)
  );
  if (!isAllowed) {
    res.status(400).json({ ok: false, error: '目前只支援 KKTIX／Accupass／OPENTIX 連結' });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      res.status(200).json({
        ok: false,
        error: `網站回應異常（狀態碼 ${response.status}），可能有防爬蟲保護，請手動輸入`,
      });
      return;
    }

    const html = await response.text();
    const meta = extractMeta(html);

    if (!meta.title) {
      res.status(200).json({ ok: false, error: '讀不到活動資訊，請手動輸入' });
      return;
    }

    res.status(200).json({
      ok: true,
      platform: detectPlatform(url),
      title: meta.title,
      date: meta.date,
      time: meta.time,
      image: meta.image,
      desc: meta.desc,
    });
  } catch (e) {
    res.status(200).json({
      ok: false,
      error: '連線逾時或讀取失敗，請確認網址正確或稍後再試',
    });
  }
};
