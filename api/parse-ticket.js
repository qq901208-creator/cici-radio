// /api/parse-ticket.js
// 伺服器端解析售票網站活動頁面（取代前端公用 CORS 代理，避免讀取失敗）
// 支援：KKTIX、Accupass、OPENTIX
// 用法：POST { url: "https://kktix.com/events/xxxx" }，並帶 Authorization: Bearer <管理者的 Firebase ID Token>
// 回傳：{ ok:true, platform, title, date, time, image, desc } 或 { ok:false, error }
//
// 與舊版的差異（資安）：
//  1. 必須是管理者登入才能用（舊版任何人都能呼叫，等於免費的網頁抓取代理，也會耗用你的函式額度）
//  2. 跟隨轉址時逐次檢查網址仍在允許的網站內（舊版 fetch 預設自動跟隨，可能被允許網站上的轉址帶到別處）
//  3. 回應不快取

const ADMIN_EMAIL = 'ciciradio3@gmail.com';
const API_KEY = process.env.FIREBASE_API_KEY || process.env.FIRESTORE_API_KEY || 'AIzaSyDXW1OHmAAc8v2nbrhHYNPqmoCsUsc3RHw';

const ALLOWED_HOSTS = [
  'kktix.cc', 'kktix.com',
  'accupass.com', 'www.accupass.com',
  'opentix.life', 'www.opentix.life',
];

const isAllowedHost = (hostname) => ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h));

// 驗證 Firebase ID Token 並確認是管理者（用 Google 的 accounts:lookup，不需要額外安裝套件）
async function verifyAdmin(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: m[1] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return false;
    const d = await r.json();
    const u = d && d.users && d.users[0];
    return !!u && String(u.email || '').toLowerCase() === ADMIN_EMAIL && u.emailVerified === true;
  } catch (e) {
    return false;
  }
}

// 跟隨轉址，但每一步都要求仍在允許的網站（最多 3 次）
async function safeFetch(startUrl, options) {
  let current = startUrl;
  for (let hop = 0; hop <= 3; hop++) {
    const u = new URL(current);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad protocol');
    if (!isAllowedHost(u.hostname)) throw new Error('redirect to disallowed host');
    const response = await fetch(current, { ...options, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const loc = response.headers.get('location');
      if (!loc) return response;
      current = new URL(loc, current).toString();
      continue;
    }
    return response;
  }
  throw new Error('too many redirects');
}

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

  // 只用「標題＋描述」猜日期，不再整包塞前 8000 字元的原始 HTML ──
  // 圖片網址、資源 ID 等雜訊數字常常長得很像日期（例如圖片 ID 571924
  // 會被誤判成「1924」年），把搜尋範圍限縮在真正的文字內容可以大幅降低誤判。
  // 同時加上「年份要落在合理範圍」的防呆，就算誤入雜訊也會被擋掉、
  // 並繼續往下找下一個候選，而不是直接採用第一個匹配。
  const searchText = `${title} ${desc}`;
  const CURRENT_YEAR = new Date().getFullYear();
  const isPlausibleYear = (y) => y >= CURRENT_YEAR - 1 && y <= CURRENT_YEAR + 3;

  let date = '';
  const dateRe = /(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/g;
  let dm;
  while ((dm = dateRe.exec(searchText)) !== null) {
    const y = +dm[1];
    if (isPlausibleYear(y)) {
      date = `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`;
      break;
    }
  }

  const timeMatch = searchText.match(/(\d{1,2}):(\d{2})/);
  const time = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '';

  return { title, image, desc, date, time };
}

// 從頁面裡「加入 Google 日曆」連結解析出精確的起訖時間（比在自由文字裡猜日期可靠很多）
// KKTIX、Accupass 的活動頁都會產生這種連結，優先用這個來源
// 同時用起訖天數差，偵測「一頁多場次」這種無法自動解析的活動，回傳警告而不是猜錯的日期
function parseGCalDates(html) {
  const m = html.match(/dates=(\d{8}T\d{6}Z)%2F(\d{8}T\d{6}Z)/);
  if (!m) return null;

  const toParts = (s) => ({
    y: +s.slice(0, 4), mo: +s.slice(4, 6), d: +s.slice(6, 8),
    h: +s.slice(9, 11), mi: +s.slice(11, 13), se: +s.slice(13, 15),
  });

  const toLocal = (p) => {
    // UTC → 台北時間（+8，無日光節約）
    const utcMs = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.se);
    const localMs = utcMs + 8 * 3600 * 1000;
    const local = new Date(localMs);
    return {
      dateStr: `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`,
      timeStr: `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`,
      epochDay: Math.floor(localMs / 86400000),
    };
  };

  const start = toLocal(toParts(m[1]));
  const end = toLocal(toParts(m[2]));
  return { start, end, dayDiff: end.epochDay - start.epochDay };
}

// OPENTIX 的 og:description 是系統套版產生的固定格式「時間:YYYY/MM/DD-YYYY/MM/DD,地點:...」
// 只能可靠取得日期範圍，無法取得精確時間（實際場次時間是頁面載入後才動態抓進選單的）
function parseOpentixDateRange(desc) {
  const m = (desc || '').match(/時間[:：]\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})-(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (!m) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const start = `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  const end = `${m[4]}-${pad(m[5])}-${pad(m[6])}`;
  return { start, end, sameDay: start === end };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  // 只有管理者能用
  if (!(await verifyAdmin(req))) {
    res.status(401).json({ ok: false, error: '需要管理者登入（請重新登入後再試）' });
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

  if (!isAllowedHost(parsed.hostname)) {
    res.status(400).json({ ok: false, error: '目前只支援 KKTIX／Accupass／OPENTIX 連結' });
    return;
  }

  try {
    const response = await safeFetch(url, {
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
    const platform = detectPlatform(url);

    if (!meta.title) {
      res.status(200).json({ ok: false, error: '讀不到活動資訊，請手動輸入' });
      return;
    }

    // KKTIX／Accupass：優先用「加入日曆」連結取得精確時間（比正文猜日期可靠很多），
    // 並偵測多場次活動（起訖天數差 ≥2 天，代表同頁合併了不同日期／地點的場次）
    if (platform === 'kktix' || platform === 'accupass') {
      const gcal = parseGCalDates(html);
      if (gcal && gcal.dayDiff >= 2) {
        res.status(200).json({
          ok: true,
          platform,
          title: meta.title,
          date: '',
          time: '',
          image: meta.image,
          desc: meta.desc,
          multiSession: true,
          warning: '這場活動疑似包含多個場次（不同日期／地點合併顯示），日期時間請對照活動介紹欄位手動填寫，避免抓到誤導性的區間。',
        });
        return;
      }
      if (gcal) {
        meta.date = gcal.start.dateStr;
        meta.time = gcal.start.timeStr;
      }
      // 找不到日曆連結的話，就沿用 extractMeta() 從標題／描述猜出的日期（已加防呆）
    }

    // OPENTIX：只信任系統套版的日期範圍，時間一律不自動填（無法可靠取得）
    if (platform === 'opentix') {
      const range = parseOpentixDateRange(meta.desc);
      meta.time = '';
      if (range && !range.sameDay) {
        res.status(200).json({
          ok: true,
          platform,
          title: meta.title,
          date: '',
          time: '',
          image: meta.image,
          desc: meta.desc,
          multiSession: true,
          warning: '這場活動橫跨多天，可能包含多個場次，日期與時間請對照節目介紹欄位手動確認。',
        });
        return;
      }
      meta.date = range ? range.start : '';
      meta.note = '⏰ OPENTIX 的確切時間無法自動判讀（場次是頁面動態載入的），請自行填寫時間';
    }

    res.status(200).json({
      ok: true,
      platform,
      title: meta.title,
      date: meta.date,
      time: meta.time,
      image: meta.image,
      desc: meta.desc,
      note: meta.note || undefined,
    });
  } catch (e) {
    res.status(200).json({
      ok: false,
      error: '連線逾時或讀取失敗，請確認網址正確或稍後再試',
    });
  }
};
