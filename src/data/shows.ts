export type ShowType = 'Stand Up' | 'Open Mic' | 'Improv' | 'Sketch' | 'Musical Comedy' | '其他'
export type TicketPlatform = 'KKTIX' | 'ACCUPASS' | 'OPENTIX' | 'Eventbrite' | '現場購票' | '免費'
export type Weekday = '一' | '二' | '三' | '四' | '五' | '六' | '日'

export interface Show {
  id: string
  slug: string
  title: { zh: string; en: string }
  image: string
  date: string
  time: string
  weekday: Weekday
  venue: string
  venueId: string
  type: ShowType
  ticketPlatform: TicketPlatform
  ticketUrl: string
  description?: { zh?: string; en?: string }
  performers?: string[]
  price?: string
}

export interface Venue {
  id: string
  name: string
  nameEn: string
  address: string
  addressEn: string
  lat: number
  lng: number
  city: 'taipei' | 'taichung' | 'kaohsiung' | 'other'
  website?: string
}

export const VENUES: Venue[] = [
  {
    id: 'satanstango',
    name: 'Satanstango',
    nameEn: 'Satanstango',
    address: '台北市大安區',
    addressEn: "Da'an District, Taipei",
    lat: 25.0268,
    lng: 121.5434,
    city: 'taipei',
  },
  {
    id: 'the-wall',
    name: 'The Wall 公館',
    nameEn: 'The Wall Gongguan',
    address: '台北市中正區羅斯福路四段200巷',
    addressEn: '200 Ln., Sec. 4, Roosevelt Rd., Taipei',
    lat: 25.0107,
    lng: 121.5347,
    city: 'taipei',
    website: 'https://www.thewall.com.tw',
  },
  {
    id: 'legacy',
    name: 'Legacy Taipei',
    nameEn: 'Legacy Taipei',
    address: '台北市中正區八德路一段1號',
    addressEn: 'No.1, Sec. 1, Bade Rd., Taipei',
    lat: 25.0461,
    lng: 121.5190,
    city: 'taipei',
  },
]

export const SHOWS: Show[] = [
  {
    id: '001',
    slug: 'taipei-stand-up-night-2025-03',
    title: { zh: '台北單口喜劇之夜 Vol.12', en: 'Taipei Stand Up Night Vol.12' },
    image: '/shows/placeholder.jpg',
    date: '2025-03-22',
    time: '20:00',
    weekday: '六',
    venue: 'Satanstango',
    venueId: 'satanstango',
    type: 'Stand Up',
    ticketPlatform: 'KKTIX',
    ticketUrl: 'https://kktix.com/',
    description: {
      zh: '台灣最受歡迎的單口喜劇常規節目，每月一次。',
      en: 'The most popular monthly stand-up show in Taiwan.',
    },
    performers: ['陳大毛', 'Kevin Wang'],
    price: 'NT$400',
  },
  {
    id: '002',
    slug: 'open-mic-tuesday-202503',
    title: { zh: '週二 Open Mic Night', en: 'Tuesday Open Mic Night' },
    image: '/shows/placeholder.jpg',
    date: '2025-03-18',
    time: '19:30',
    weekday: '二',
    venue: 'The Wall 公館',
    venueId: 'the-wall',
    type: 'Open Mic',
    ticketPlatform: '免費',
    ticketUrl: '',
    description: {
      zh: '每週二免費 Open Mic，歡迎新手！',
      en: 'Weekly free open mic night.',
    },
    price: '免費',
  },
  {
    id: '003',
    slug: 'improv-spring-2025',
    title: { zh: '即興喜劇春季演出', en: 'Improv Spring Showcase 2025' },
    image: '/shows/placeholder.jpg'
