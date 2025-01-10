import axios from 'axios'

import { CSFloatBuyOrder, CSFloatItemInfo, CSFloatListing, CSFloatMarketHashNameHistory } from '../types'

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
  filter,
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
  filter?: string
}): Promise<CSFloatListing> => {
  const { data } = await http.get('/v1/listings', {
    params: { limit, category, type, min_float, max_float, market_hash_name, sort_by, min_price, max_price, filter },
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

export const getMarketHashNameHistory = async ({
  market_hash_name,
}: {
  market_hash_name: string
}): Promise<CSFloatMarketHashNameHistory[]> => {
  const { data } = await http.get(`/v1/history/${market_hash_name}/sales`, {
    headers: {
      Cookie: `session=${process.env.CSFLOAT_SESSION_TOKEN}`,
    },
  })

  return data
}

export const getCSFloatItemInfo = async ({ url }: { url: string }): Promise<CSFloatItemInfo> => {
  const { data } = await axios.get('https://api.csfloat.com/', {
    params: {
      url,
    },
    headers: {
      Referer: 'https://csfloat.com/',
      Origin: 'https://csfloat.com/',
      Cookie: `session=${process.env.CSFLOAT_SESSION_TOKEN}`,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  })

  return data
}
