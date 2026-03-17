import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { SHOWS } from '@/data/shows'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('hero')

  return (
    <>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #f5d558 0%, #ffefa6 50%, #ef6f20 100%)' }}
        className="relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">
          <span className="inline-block bg-white/40 text-gray-800 text-xs font-bold px-3 py-1 rounded-full mb-6">
            🎤 Taiwan Comedy Guide · 台灣喜劇資訊站
          </span>
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-tight mb-6">
            {t('title')}
          </h1>
          <p className="text-lg text-gray-700 mb-10 max-w-xl">
            {t('subtitle')}
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/shows"
              className="bg-gray-900 text-white font-bold px-8 py-4 rounded-full hover:bg-gray-800 transition-colors">
              {t('cta')}
            </Link>
            <Link href="/open-mic"
              className="bg-white/70 text-gray-900 font-bold px-8 py-4 rounded-full hover:bg-white transition-colors">
              {t('ctaOpenMic')
