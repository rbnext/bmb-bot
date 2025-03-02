import axios from 'axios'
import { sleep } from '../utils'

export const getVercelMarketRender = async ({
  market_hash_name,
  start = 0,
  count = 10,
  retries = 2,
  proxy,
  filter,
}: {
  market_hash_name: string
  start?: number
  count?: number
  proxy: string
  filter?: string
  retries?: number
}) => {
  const params = `start=${start}&count=${count}&country=BY&language=english&currency=1${filter ? `&filter=${filter}` : ''}`

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { data } = await axios.post(`https://${proxy}.vercel.app/api/steam/render`, {
        url: `https://steamcommunity.com/market/listings/730/${encodeURIComponent(market_hash_name)}/render?${params}`,
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
