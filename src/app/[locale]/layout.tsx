import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import '../globals.css'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const siteName = locale === 'zh' ? '嘻嘻哪裡唷 | 台灣喜劇演出資訊站' : 'cici._.radio | Comedy Guide Taiwan'
  return {
    metadataBase: new URL('https://cici-radio.vercel.app'),
    title: { default: siteName, template: `%s | ${siteName}` },
    description: locale === 'zh'
      ? '整合台灣喜劇演出資訊，包含單口喜劇、即興劇場、Open Mic 報名，全台最完整的喜劇資訊平台。'
      : 'Your guide to stand-up comedy, improv, and open mic shows across Taiwan.',
    keywords: ['台灣喜劇', '喜劇演出', 'stand up comedy Taiwan', 'open mic 台北', 'improv Taiwan'],
  }
}

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }))
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!routing.locales.includes(locale as 'zh' | 'en')) {
    notFound()
  }
  const message
