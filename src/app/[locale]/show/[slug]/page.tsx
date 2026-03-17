import { notFound } from 'next/navigation'
import { getShowBySlug, getVenueById, formatDate, SHOWS } from '@/data/shows'
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

  const venue = getVenueById(show.venueId)
  const lang = locale as 'zh' | 'en'
  const title = lang === 'zh' ? show.title.zh : show.title.en
  const description = lang === 'zh' ? show.description?.zh : show.description?.en

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: show.title.zh,
    startDate: `${show.date}T${show.time}:00+08:00`,
    location: {
      '@type': 'Place',
      name: show.venue,
      address: venue?.address ?? show.venue,
    },
    offers: {
      '@type': 'Offer',
      url: show.ticketUrl || undefined,
      price: show.price,
      priceCurrency: 'TWD',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/shows" className="text-orange-500 font-semibold hover:underline mb-6 inline-block text-sm">
          ← {lang === '
