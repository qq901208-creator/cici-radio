const SHEET_ID = '17APEmUNVVUixIMuqyiqcpo0l-cUeC2xDNfHG1KL4Tdw'

async function fetchOpenMicData() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const csv = await res.text()
    const lines = csv.split('\n').filter(Boolean)
    return lines.map((line, i) => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      return {
        id: String(i),
        venueName: cols[0] ?? '',
        date: cols[1] ?? '',
        time: cols[2] ?? '',
        signupUrl: cols[3] ?? '',
        signupDeadline: cols[4] ?? '',
        hostName: cols[5] ?? '',
        notes: cols[6] ?? '',
        isFree: cols[7] === '是' || cols[7]?.toLowerCase() === 'true',
      }
    }).filter(row => row.venueName)
  } catch {
    return []
  }
}

export default async function OpenMicPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const sessions = await fetchOpenMicData()

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-black mb-2">
        {locale === 'zh' ? 'Open Mic 報名資訊' : 'Open Mic Sign-Up Info'}
      </h1>
      <p className="text-gray-500 text-sm mb-2">
        {locale === 'zh' ? '資料由 Google Sheets 即時同步' : 'Data synced fr
