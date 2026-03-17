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
          <Link key={show.id} href={`/show/${show.slu
