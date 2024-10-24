import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { MarketGoods } from '../types'
import { parse } from 'set-cookie-parser'
import { getCookies } from './buff'

export const PROXY_AGENTS = [new HttpsProxyAgent(process.env.PROXY_URL_1 as string)]

const PROXY_HEADERS = [
  {
    'x-csrftoken': '',
    'user-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 8_7_7; en-US) Gecko/20130401 Firefox/60.3',
  },
]

const PROXY_COOKIES = [
  {
    'Device-Id': '',
    client_id: '',
    csrf_token: '',
  },
]

export const getPublicMarketGoods = async ({
  game = 'csgo',
  page_num = 1,
  page_size = 50,
  proxy_index = 0,
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
    params: { game, page_num, page_size },
    httpsAgent: PROXY_AGENTS[proxy_index],
    httpAgent: PROXY_AGENTS[proxy_index],
    headers: { ...PROXY_HEADERS[proxy_index], cookie: getCookies(PROXY_COOKIES[proxy_index]) },
  })

  const setCookieHeader = headers['set-cookie']

  if (setCookieHeader) {
    const cookies = parse(setCookieHeader, { map: true })

    const device_id = 'Device-Id'
    const csrf_token = 'csrf_token'
    const client_id = 'client_id'

    if (cookies[csrf_token]) {
      PROXY_HEADERS[proxy_index]['x-csrftoken'] = cookies[csrf_token].value
    }

    if (cookies[device_id]) {
      PROXY_COOKIES[proxy_index][device_id] = cookies[device_id].value
    }

    if (cookies[csrf_token]) {
      PROXY_COOKIES[proxy_index][csrf_token] = cookies[csrf_token].value
    }

    if (cookies[client_id]) {
      PROXY_COOKIES[proxy_index][client_id] = cookies[client_id].value
    }
  }

  return data
}
