import { SHOWS } from '@/data/shows'
import { Link } from '@/i18n/routing'

export default async function ShowsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-black mb-8">
        {locale === 'zh' ? '所有演出' : 'All Shows'}
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {SHOWS.map(show => (
          <Link
            key={show.id}
            href={`/show/${show.slug}`}
            className="bg-white rounded-2xl p-5 hover:shadow-md transition-shadow block"
          >
            <span
              className="text-xs font-bold text-white px-2 py-1 rounded-full mb-3 inline-block"
              style={{ backgroundColor: '#ef6f20' }}
            >
              {show.type}
            </span>
            <h2 className="font-bold text-gray-900 mb-2">
              {locale === 'zh' ? show.title.zh : show.title.en}
            </h2>
            <p className="text-sm text-gray-500">📅 {show.date} {show.time}</p>
            <p className="text-sm text-gray-500">📍 {show.venue}</p>
            <p className="text-sm text-gray-500 mt-1">🎟 {show.ticketPlatform}</p>
            {show.price && (
              <p className="text-sm font-bold mt-2" style={{ color: '#ef6f20' }}>
                {show.price}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
