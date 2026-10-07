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
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const sv = (f) => (f && typeof f.stringValue === 'string') ? f.stringValue : undefined;
const iv = (f) => (f && f.integerValue !== undefined) ? Number(f.integerValue) : undefined;

async function getDocFields(path) {
  const r = await fetch(`${BASE}/${path}?key=${API_KEY}`, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) return null;
  const d = await r.json();
  return d.fields || null;
}

// 讀後台發布的快照（格式與網頁端相同：目錄 meta/snapshot ＋ 內容 meta/snapshot_0…，內容是 gzip＋base64）
async function loadSnapshot() {
  const mf = await getDocFields('meta/snapshot');
  if (!mf) return null;
  const n = iv(mf.n), len = iv(mf.len), ts = iv(mf.ts), raw = iv(mf.raw), enc = sv(mf.enc);
  if (!(n >= 1 && n <= 20)) return null;
  const parts = await Promise.all(Array.from({ length: n }, (_, i) => getDocFields('meta/snapshot_' + i)));
  let txt = '';
  for (const p of parts) {
    if (!p) return null;
    if (iv(p.t) !== ts) return null;          // 目錄與內容不是同一次發布（寫到一半）
    txt += sv(p.p) || '';
  }
  if (txt.length !== len) return null;
  if (enc === 'gz') {
    try { txt = gunzipSync(Buffer.from(txt, 'base64')).toString('utf8'); } catch (e) { return null; }
    if (raw && txt.length !== raw) return null;
  } else if (enc) return null;
  try {
    const d = JSON.parse(txt);
    if (d && d.v === 1 && Array.isArray(d.shows) && Array.isArray(d.performers)) return d;
  } catch (e) {}
  return null;
}

// 舊版讀法（備援）：逐筆列出集合
async function loadFromCollections(today) {
  const shows = [], performers = [];
  const showsRes = await fetch(`${BASE}/shows?key=${API_KEY}&pageSize=300`, { signal: AbortSignal.timeout(8000) });
  if (showsRes.ok) {
    const data = await showsRes.json();
    for (const doc of (data.documents || [])) {
      const f = doc.fields || {};
      shows.push({ id: doc.name.split('/').pop(), status: sv(f.status) || 'published', date: sv(f.date) || '' });
    }
  }
  const perfRes = await fetch(`${BASE}/performers?key=${API_KEY}&pageSize=300`, { signal: AbortSignal.timeout(8000) });
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

  const urls = [
    { loc: SITE_URL, priority: '1.0', changefreq: 'daily' },
    { loc: `${SITE_URL}/#shows`, priority: '0.9', changefreq: 'daily' },
    { loc: `${SITE_URL}/#performers`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${SITE_URL}/#venues`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${SITE_URL}/#opmic`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${SITE_URL}/#courses`, priority: '0.6', changefreq: 'weekly' },
    { loc: `${SITE_URL}/#about`, priority: '0.5', changefreq: 'monthly' },
  ];

  try {
    let data = null;
    try { data = await loadSnapshot(); } catch (e) { data = null; }
    if (!data) data = await loadFromCollections(today);

    for (const s of data.shows) {
      if (!s || !ID_RE.test(String(s.id))) continue;
      const status = s.status || 'published';
      // 只收錄已發布且未過期的演出
      if (status === 'published' && String(s.date || '') >= today) {
        urls.push({ loc: `${SITE_URL}/show/${s.id}`, priority: '0.8', changefreq: 'weekly', lastmod: today });
      }
    }
    for (const p of data.performers) {
      if (!p || !ID_RE.test(String(p.id))) continue;
      if ((p.status || 'published') !== 'hidden') {
        urls.push({ loc: `${SITE_URL}/performer/${p.id}`, priority: '0.7', changefreq: 'weekly', lastmod: today });
      }
    }
  } catch (e) {
    // 讀取失敗就只回傳靜態頁面
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
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).send(xml);
}
