import axios from 'axios'
import { SteamMarketRender } from '../types'

export const getVercelMarketRender = async ({
  appid = 730,
  currency = 1,
  country = 'BY',
  language = 'english',
  market_hash_name,
  query,
  start,
  count,
}: {
  appid?: number
  currency?: number
  country?: string
  language?: string
  market_hash_name: string
  query?: string
  start: number
  count: number
}): Promise<SteamMarketRender> => {
  const { data } = await axios.post<SteamMarketRender>('https://api-next-gateway2.vercel.app/api', {
    url: `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(market_hash_name)}/render?query=${query}&country=${country}&currency=${currency}&language=${language}&start=${start}&count=${count}`,
  })

  return data
}
// https://api-next-gateway1.vercel.app/api
// https://api-next-gateway2.vercel.app/api
