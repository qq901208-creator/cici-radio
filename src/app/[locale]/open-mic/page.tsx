import { notFound } from 'next/navigation'
import { getShowBySlug, formatDate, SHOWS } from '@/data/shows'
import { Link } from '@/i18n/routing'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateStaticParams() {
  return SHOWS.flatMap(show =>
    ['zh', 'en'].map(locale => ({ locale, slug: show.slug }))
  )
}

export default async function ShowDetailPage({ params }: Props) {
  const { locale, slug } = await params
  const show = getShowBySlug(slug)
  if (!show) notFound()

  const lang = locale as 'zh' | 'en'
  const title = lang === 'zh' ? show.title.zh : show.title.en
  const description = lang === 'zh' ? show.description?.zh : show.description?.en
  const formattedDate = formatDate(show.date, lang)

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link
        href="/shows"
        className="text-sm font-semibold hover:underline mb-6 inline-block"
        style={{ color: '#ef6f20' }}
      >
        ← {lang === 'zh' ? '所有演出' : 'All Shows'}
      </Link>

      <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
        <div className="p-8">
          <span
            className="text-xs font-bold text-white px-3 py-1 rounded-full inline-block mb-4"
            style={{ backgroundColor: '#ef6f20' }}
          >
            {show.type} · {show.ticketPlatform}
          </span>

          <h1 className="text-3xl font-black text-gray-900 mb-6">{title}</h1>

          <div
            className="grid grid-cols-2 gap-4 mb-6 p-5 rounded-2xl"
            style={{ backgroundColor: '#ffefa6' }}
          >
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">
                {lang === 'zh' ? '日期' : 'Date'}
              </p>
              <p className="font-semibold">{formattedDate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">
                {lang === 'zh' ? '時間' : 'Time'}
              </p>
              <p className="font-semibold">{show.time}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">
                {lang === 'zh' ? '場地' : 'Venue'}
              </p>
              <p className="font-semibold">{show.venue}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">
                {lang === 'zh' ? '票價' : 'Price'}
              </p>
              <p className="font-semibold">
                {show.price ?? (lang === 'zh' ? '待確認' : 'TBC')}
              </p>
            </div>
          </div>

          {description && (
            <div className="mb-8">
              <h2 className="text-lg font-bold mb-2">
                {lang === 'zh' ? '演出介紹' : 'About'}
              </h2>
              <p className="text-gray-700 leading-relaxed">{description}</p>
            </div>
          )}

          {show.performers && show.performers.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-bold mb-3">
                {lang === 'zh' ? '表演者' : 'Performers'}
              </h2>
              <div className="flex flex-wrap gap-2">
                {show.performers.map(p => (
                  <span
                    key={p}
                    className="px-4 py-2 rounded-full text-sm font-semibold"
                    style={{ backgroundColor: '#f5d558' }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {show.ticketUrl ? (
            
              href={show.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center text-white font-black text-lg py-4 rounded-2xl hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#ef6f20' }}
            >
              {lang === 'zh' ? '立即購票' : 'Get Tickets'} → {show.ticketPlatform}
            </a>
          ) : (
            <div className="text-center py-4 rounded-2xl bg-emerald-100 text-emerald-800 font-bold">
              {lang === 'zh' ? '免費入場' : 'Free Entry'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
