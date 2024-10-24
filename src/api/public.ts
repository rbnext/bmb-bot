import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { MarketGoods } from '../types'

export const PROXY_AGENTS = [new HttpsProxyAgent(process.env.PROXY_URL_1 as string)]

const PROXY_HEADERS = [
  {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 8_7_7; en-US) Gecko/20130401 Firefox/60.3',
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
  const { data } = await axios.get('https://api.buff.market/api/market/goods', {
    params: { game, page_num, page_size },
    httpsAgent: PROXY_AGENTS[proxy_index],
    httpAgent: PROXY_AGENTS[proxy_index],
    headers: PROXY_HEADERS[proxy_index],
  })

  return data
}

export const checkCountryIP = async () => {
  const { data } = await axios.get('https://api.country.is/', {
    httpsAgent: PROXY_AGENTS[0],
    httpAgent: PROXY_AGENTS[0],
    headers: PROXY_HEADERS[0],
  })

  return data
}
