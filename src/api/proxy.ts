import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { MarketGoods } from '../types'
import { parse } from 'set-cookie-parser'
import { getCookies } from './buff'

export const PROXY_AGENTS = [new HttpsProxyAgent(process.env.PROXY_URL_1 as string)]

const PROXY_HEADERS = [
  {
    'x-csrftoken': process.env.PROXY_CSRF_TOKEN_1 as string,
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 8_7_7; en-US) Gecko/20130401 Firefox/60.3',
  },
]

const PROXY_COOKIES = [
  {
    csrf_token: process.env.PROXY_CSRF_TOKEN_1 as string,
    session: process.env.PROXY_SESSION_TOKEN_1 as string,
  },
]

export const getProxyMarketGoods = async ({
  game = 'csgo',
  page_num = 1,
  page_size = 50,
  proxy_index = 0,
  max_price,
  min_price,
}: {
  game?: string
  search?: string
  page_num?: number
  page_size?: number
  min_price?: number
  max_price?: number
  proxy_index?: number
}): Promise<MarketGoods> => {
  const { data, headers } = await axios.get('https://api.buff.market/api/market/goods', {
    params: { game, page_num, page_size, min_price, max_price },
    httpsAgent: PROXY_AGENTS[proxy_index],
    httpAgent: PROXY_AGENTS[proxy_index],
    headers: { ...PROXY_HEADERS[proxy_index], cookie: getCookies(PROXY_COOKIES[proxy_index]) },
  })

  const setCookieHeader = headers['set-cookie']

  if (setCookieHeader) {
    const cookies = parse(setCookieHeader, { map: true })

    const session = 'session'
    const csrf_token = 'csrf_token'

    if (cookies[session]) PROXY_COOKIES[proxy_index][session] = cookies[session].value
    if (cookies[csrf_token]) PROXY_COOKIES[proxy_index][csrf_token] = cookies[csrf_token].value

    if (cookies[csrf_token]) PROXY_HEADERS[proxy_index]['x-csrftoken'] = cookies[csrf_token].value
  }

  return data
}

export const checkCountryIP = async () => {
  const { data } = await axios.get('https://api.country.is/', {
    httpsAgent: PROXY_AGENTS[0],
    httpAgent: PROXY_AGENTS[0],
  })

  return data
}
