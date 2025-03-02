import axios from 'axios'
import { MapSteamMarketRenderResponse, SearchMarketRenderItem } from '../types'
import { sleep } from '../utils'

export const getVercelMarketRender = async ({
  market_hash_name,
  start = 0,
  count = 10,
  proxy,
  filter,
}: {
  market_hash_name: string
  start?: number
  count?: number
  proxy: string
  filter?: string
}): Promise<MapSteamMarketRenderResponse[]> => {
  const params = `start=${start}&count=${count}&country=BY&language=english&currency=1${filter ? `&filter=${filter}` : ''}`

  const { data } = await axios.post(`https://${proxy}.vercel.app/api/steam/render`, {
    url: `https://steamcommunity.com/market/listings/730/${encodeURIComponent(market_hash_name)}/render?${params}`,
  })

  return data
}

export const getVercelSearchMarketRender = async ({
  proxy,
  start,
  count,
  retries = 2,
}: {
  start: number
  count: number
  proxy: string
  retries?: number
}) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { data } = await axios.post(`https://${proxy}.vercel.app/api/steam/search`, {
        start,
        count,
      })

      return data
    } catch (error) {
      if (attempt === retries - 1) {
        throw error
      }

      await sleep(500)
    }
  }
}
