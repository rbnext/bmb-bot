import axios from 'axios'

import { CSFloatBuyOrder, CSFloatListing } from '../types'

const http = axios.create({
  baseURL: 'https://csfloat.com/api',
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
})

export const getCSFloatListings = async ({
  type = 'buy_now',
  limit = 40,
  min_float,
  max_float,
  market_hash_name,
  sort_by = 'lowest_price',
  category,
  min_price,
  max_price,
}: {
  type?: string
  limit?: number
  min_float?: number
  max_float?: number
  market_hash_name?: string
  sort_by?: string
  category?: number
  min_price?: number
  max_price?: number
}): Promise<CSFloatListing> => {
  const { data } = await http.get('/v1/listings', {
    params: { limit, category, type, min_float, max_float, market_hash_name, sort_by, min_price, max_price },
    headers: {
      Cookie: `session=${process.env.CSFLOAT_SESSION_TOKEN}`,
    },
  })

  return data
}

export const getBuyOrders = async ({ id, limit = 10 }: { id: string; limit?: number }): Promise<CSFloatBuyOrder[]> => {
  const { data, headers } = await http.get(`/v1/listings/${id}/buy-orders`, {
    params: { limit },
    headers: {
      Cookie: `session=${process.env.CSFLOAT_SESSION_TOKEN}`,
    },
  })

  console.log('x-ratelimit-remaining', Number(headers['x-ratelimit-remaining']))

  return data
}
