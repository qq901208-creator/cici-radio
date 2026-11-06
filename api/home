// api/home.js
// 首頁（/）經過這支程式：把「近期演出」寫成 schema.org Event 結構化資料，直接放進回傳的網頁。
// 為什麼要這樣做：網站是載入後才由 JavaScript 畫出演出，Google 的測試工具只等幾秒，常常等不到資料，
//                 所以改成伺服器先把結構化資料放好，Google 一打開就看得到。
// 安全設計：任何一步失敗，都退回「原封不動的 index.html」，不會讓首頁打不開。
// 資料來源：後台「發布快照」（與 sitemap 相同的讀法，約 3 次讀取）；回應快取 5 分鐘，所以不會每個訪客都讀資料庫。

import { gunzipSync } from 'zlib';

const SITE_URL = 'https://cici-radio.vercel.app';
const PROJECT_ID = 'cici-radio-e7902';
const API_KEY = process.env.FIRESTORE_API_KEY || 'AIzaSyDXW1OHmAAc8v2nbrhHYNPqmoCsUsc3RHw';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const sv = (f) => (f && typeof f.stringValue === 'string') ? f.stringValue : undefined;
const iv = (f) => (f && f.integerValue !== undefined) ? Number(f.integerValue) : undefined;

async function getDocFields(path) {
  const r = await fetch(`${BASE}/${path}?key=${API_KEY}`, { signal: AbortSignal.timeout(4000) });
  if (!r.ok) return null;
  const d = await r.json();
  return d.fields || null;
}

async function loadSnapshot() {
  const mf = await getDocFields('meta/snapshot');
  if (!mf) return null;
  const n = iv(mf.n), len = iv(mf.len), ts = iv(mf.ts), raw = iv(mf.raw), enc = sv(mf.enc);
  if (!(n >= 1 && n <= 20)) return null;
  const parts = await Promise.all(Array.from({ length: n }, (_, i) => getDocFields('meta/snapshot_' + i)));
  let txt = '';
  for (const p of parts) {
    if (!p || iv(p.t) !== ts) return null;
    txt += sv(p.p) || '';
  }
  if (txt.length !== len) return null;
  if (enc === 'gz') {
    txt = gunzipSync(Buffer.from(txt, 'base64')).toString('utf8');
    if (raw && txt.length !== raw) return null;
  } else if (enc) return null;
  const d = JSON.parse(txt);
  return (d && d.v === 1 && Array.isArray(d.shows)) ? d : null;
}

const AREA = { taipei: '台北', taoyuan: '桃園', hsinchu: '新竹', taichung: '台中', tainan: '台南', kaohsiung: '高雄' };

function buildEvents(data) {
  const nowTw = new Date(Date.now() + 8 * 3600 * 1000);
  const today = nowTw.toISOString().slice(0, 10);
  const nowHm = nowTw.toISOString().slice(11, 16);
  const venueLabels = {};
  for (const v of ((data.meta && data.meta.showVenues) || [])) if (v && v.id) venueLabels[v.id] = v.labelZh || v.label || '';
  const venues = data.venues || [];

  const list = (data.shows || []).filter((s) => {
    if (!s || !s.id || !s.title || !/^\d{4}-\d{2}-\d{2}$/.test(String(s.date || ''))) return false;
    const st = s.status || 'published';
    if (st === 'hidden' || st === 'archived' || st === 'postponed') return false;
    const t = /^\d{1,2}:\d{2}$/.test(String(s.time || '')) ? String(s.time).padStart(5, '0') : '23:59';
    return s.date > today || (s.date === today && t >= nowHm);
  }).sort((a, b) => String(a.date + (a.time || '')).localeCompare(String(b.date + (b.time || '')))).slice(0, 40);

  return list.map((s) => {
    const time = /^\d{1,2}:\d{2}$/.test(String(s.time || '')) ? String(s.time).padStart(5, '0') : '00:00';
    const label = String(s.venueLabel || venueLabels[s.venue] || s.venue || '現場');
    const v = venues.find((x) => x && x.nameZh && (label.includes(x.nameZh) || x.nameZh.includes(label)));
    const ev = {
      '@type': 'Event',
      name: String(s.title).slice(0, 110),
      startDate: `${s.date}T${time}:00+08:00`,
      eventStatus: s.status === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place', name: label,
        address: { '@type': 'PostalAddress', addressCountry: 'TW', ...(v && v.address ? { streetAddress: String(v.address) } : {}), ...(AREA[s.area] ? { addressLocality: AREA[s.area] } : {}) },
      },
      url: `${SITE_URL}/show/${encodeURIComponent(s.id)}`,
    };
    if (s.image && /^https?:\/\//.test(String(s.image).trim())) ev.image = [String(s.image).trim()];
    const perf = String(s.performer || '').split(/[、,，\/]/).map((x) => x.replace(/[（(].*?[）)]/g, '').trim()).filter(Boolean).slice(0, 10);
    if (perf.length) ev.performer = perf.map((n) => ({ '@type': 'Person', name: n }));
    const priceNum = String(s.price || '').match(/(\d[\d,]*)/);
    if (s.ticketUrl && /^https?:\/\//.test(s.ticketUrl) && priceNum) {
      ev.offers = { '@type': 'Offer', url: s.ticketUrl, price: priceNum[1].replace(/,/g, ''), priceCurrency: 'TWD', availability: s.soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock' };
    }
    return ev;
  });
}

async function getStaticHtml() {
  const r = await fetch(`${SITE_URL}/index.html`, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error('index.html ' + r.status);
  return await r.text();
}

export default async function handler(req, res) {
  let html;
  try { html = await getStaticHtml(); }
  catch (e) {
    console.error('home: cannot load index.html', e && e.message);
    res.writeHead(302, { Location: `${SITE_URL}/index.html` });
    res.end();
    return;
  }
  let injected = false;
  try {
    const data = await loadSnapshot();
    const events = data ? buildEvents(data) : [];
    if (events.length && html.includes('</head>')) {
      const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': events }).replace(/</g, '\\u003c');
      html = html.replace('</head>', () => `<script type="application/ld+json" id="ld-events">${json}</script>\n</head>`);
      injected = true;
    }
  } catch (e) {
    console.warn('home: structured data skipped:', e && e.message);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // 成功放入資料：快取 5 分鐘；沒放成功：只快取 30 秒，很快會再試一次
  res.setHeader('Cache-Control', injected ? 'public, s-maxage=300, stale-while-revalidate=600' : 'public, s-maxage=30');
  res.status(200).send(html);
}
