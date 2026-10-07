// api/sitemap.js
// 動態生成 sitemap.xml，包含所有演出和演員頁面
//
// 與舊版的差異：
//  1. 優先讀後台發布的「快照」（meta/snapshot，約 3 次讀取），取代舊版每次讀 300 筆演出＋演員（約 365 次讀取）
//  2. 舊版 pageSize=300 沒有翻頁，演出超過 300 筆時 sitemap 會漏掉大部分；快照包含所有「近 31 天到未來」的已發布演出
//  3. 快照讀不到、格式不對時，自動退回舊版的讀法
//  4. 網址一律檢查 id 格式並跳脫，避免 XML 被塞入內容

import { gunzipSync } from 'zlib';

const SITE_URL = 'https://cici-radio.vercel.app';
const PROJECT_ID = 'cici-radio-e7902';
const API_KEY = process.env.FIRESTORE_API_KEY || 'AIzaSyDXW1OHmAAc8v2nbrhHYNPqmoCsUsc3RHw';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
// ID 不再整筆丟掉：只排除空白、含斜線／控制字元、或過長的 ID；其餘一律用網址編碼放進網址
const idOk = (id) => typeof id === 'string' && id.length >= 1 && id.length <= 200 && !/[\/\\?#\u0000-\u001f\u007f]/.test(id);

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const sv = (f) => (f && typeof f.stringValue === 'string') ? f.stringValue : undefined;
const iv = (f) => (f && f.integerValue !== undefined) ? Number(f.integerValue) : undefined;

async function getDocFields(path, diag) {
  const r = await fetch(`${BASE}/${path}?key=${API_KEY}`, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) { if (diag) (diag.http = diag.http || {})[path] = r.status; return null; }
  const d = await r.json();
  return d.fields || null;
}

// 讀後台發布的快照（格式與網頁端相同：目錄 meta/snapshot ＋ 內容 meta/snapshot_0…，內容是 gzip＋base64）
async function loadSnapshot(diag) {
  const fail = (why) => { diag.snapshotReason = why; return null; };
  const mf = await getDocFields('meta/snapshot', diag);
  if (!mf) return fail('目錄讀不到');
  const n = iv(mf.n), len = iv(mf.len), ts = iv(mf.ts), raw = iv(mf.raw), enc = sv(mf.enc);
  if (!(n >= 1 && n <= 20)) return fail('份數不合理');
  const parts = await Promise.all(Array.from({ length: n }, (_, i) => getDocFields('meta/snapshot_' + i, diag)));
  let txt = '';
  for (const p of parts) {
    if (!p) return fail('缺少內容份');
    if (iv(p.t) !== ts) return fail('目錄與內容不是同一次發布');
    txt += sv(p.p) || '';
  }
  if (txt.length !== len) return fail('長度對不上');
  if (enc === 'gz') {
    try { txt = gunzipSync(Buffer.from(txt, 'base64')).toString('utf8'); } catch (e) { return fail('解壓失敗'); }
    if (raw && txt.length !== raw) return fail('解壓後長度對不上');
  } else if (enc) return fail('不認得的壓縮格式');
  try {
    const d = JSON.parse(txt);
    if (d && d.v === 1 && Array.isArray(d.shows) && Array.isArray(d.performers)) return d;
    return fail('資料格式不對');
  } catch (e) { return fail('JSON 損毀'); }
}

// 舊版讀法（備援）：逐筆列出集合
async function loadFromCollections(today, diag) {
  const shows = [], performers = [];
  const showsRes = await fetch(`${BASE}/shows?key=${API_KEY}&pageSize=300`, { signal: AbortSignal.timeout(8000) });
  if (!showsRes.ok) (diag.http = diag.http || {})['shows'] = showsRes.status;
  if (showsRes.ok) {
    const data = await showsRes.json();
    for (const doc of (data.documents || [])) {
      const f = doc.fields || {};
      shows.push({ id: doc.name.split('/').pop(), status: sv(f.status) || 'published', date: sv(f.date) || '' });
    }
  }
  const perfRes = await fetch(`${BASE}/performers?key=${API_KEY}&pageSize=300`, { signal: AbortSignal.timeout(8000) });
  if (!perfRes.ok) (diag.http = diag.http || {})['performers'] = perfRes.status;
  if (perfRes.ok) {
    const data = await perfRes.json();
    for (const doc of (data.documents || [])) {
      const f = doc.fields || {};
      performers.push({ id: doc.name.split('/').pop(), status: sv(f.status) || 'published' });
    }
  }
  return { shows, performers };
}

export default async function handler(req, res) {
  // 台灣時間的今天（演出日期是台灣時間）
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const debug = req.query && req.query.debug === '1';
  const diag = { today, source: 'none', errors: [] };

  const urls = [
    { loc: SITE_URL, priority: '1.0', changefreq: 'daily' },
    { loc: `${SITE_URL}/#shows`, priority: '0.9', changefreq: 'daily' },
    { loc: `${SITE_URL}/#performers`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${SITE_URL}/#venues`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${SITE_URL}/#opmic`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${SITE_URL}/#courses`, priority: '0.6', changefreq: 'weekly' },
    { loc: `${SITE_URL}/#about`, priority: '0.5', changefreq: 'monthly' },
  ];
  let showCount = 0, perfCount = 0;
  const dropped = { badId: [], notPublishedOrPast: 0, hiddenPerformers: 0 };

  try {
    let data = null;
    try { data = await loadSnapshot(diag); } catch (e) { diag.errors.push('snapshot: ' + (e && e.message)); data = null; }
    if (data) diag.source = 'snapshot';
    else {
      data = await loadFromCollections(today, diag);
      diag.source = 'collections';
    }
    diag.showsInData = data.shows.length;
    diag.performersInData = data.performers.length;

    for (const s of data.shows) {
      if (!s) continue;
      if (!idOk(String(s.id))) { if (dropped.badId.length < 5) dropped.badId.push(String(s.id)); continue; }
      const status = s.status || 'published';
      // 只收錄已發布且未過期的演出
      if (status === 'published' && String(s.date || '') >= today) {
        urls.push({ loc: `${SITE_URL}/show/${encodeURIComponent(s.id)}`, priority: '0.8', changefreq: 'weekly', lastmod: today });
        showCount++;
      } else dropped.notPublishedOrPast++;
    }
    for (const p of data.performers) {
      if (!p) continue;
      if (!idOk(String(p.id))) { if (dropped.badId.length < 5) dropped.badId.push(String(p.id)); continue; }
      if ((p.status || 'published') !== 'hidden') {
        urls.push({ loc: `${SITE_URL}/performer/${encodeURIComponent(p.id)}`, priority: '0.7', changefreq: 'weekly', lastmod: today });
        perfCount++;
      } else dropped.hiddenPerformers++;
    }
  } catch (e) {
    // 讀取失敗就只回傳靜態頁面，並在 Vercel Logs 留下原因
    diag.errors.push('fatal: ' + (e && e.message));
    console.error('sitemap error:', e);
  }
  diag.showsKept = showCount; diag.performersKept = perfCount; diag.dropped = dropped;
  if (diag.errors.length || diag.snapshotReason) console.warn('sitemap diag:', JSON.stringify(diag));

  // 診斷模式：打開 /sitemap.xml?debug=1，看實際走哪條路、讀到多少、為什麼被排除（不含任何金鑰）
  if (debug) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(JSON.stringify(diag, null, 2));
    return;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${xmlEsc(u.loc)}</loc>
    <priority>${u.priority}</priority>
    <changefreq>${u.changefreq}</changefreq>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // 讀不到任何演出／演員時（可能是暫時性失敗）只快取 1 分鐘，避免把「只有靜態頁面」的結果存一小時
  res.setHeader('Cache-Control', (showCount + perfCount) > 0 ? 's-maxage=3600, stale-while-revalidate' : 's-maxage=60');
  res.status(200).send(xml);
}
