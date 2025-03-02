import axios from 'axios'
import { sleep } from '../utils'

export const getVercelMarketRender = async ({
  market_hash_name,
  retries = 2,
  proxy,
  filter,
}: {
  market_hash_name: string
  proxy: string
  filter?: string
  retries?: number
}) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { data } = await axios.post(`https://${proxy}.vercel.app/api/steam/render`, {
        market_hash_name,
        filter,
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
