import axios from 'axios'

import {
  CSFloatBuyOrder,
  CSFloatItemInfo,
  CSFloatListing,
  CSFloatMarketHashNameHistory,
  CSFloatPlacedOrders,
  CSFloatSimpleOrders,
  CSFloatTradesResponse,
} from '../types'

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
  stickers,
  keychains,
  filter,
  session,
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
  stickers?: string
  keychains?: string
  filter?: string
  session?: string
}): Promise<CSFloatListing> => {
  const { data, headers } = await http.get('/v1/listings', {
    params: {
      limit,
      category,
      type,
      min_float,
      max_float,
      market_hash_name,
      sort_by,
      min_price,
      max_price,
      keychains,
      filter,
      stickers,
    },
    headers: {
      Cookie: `session=${session ?? process.env.CSFLOAT_SESSION_TOKEN}`,
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

export const getCSFloatSimpleOrders = async ({
  limit = 10,
  market_hash_name,
}: {
  limit?: number
  market_hash_name: string
}): Promise<CSFloatSimpleOrders> => {
  const { data } = await http.post(
    '/v1/buy-orders/similar-orders',
    { market_hash_name },
    {
      params: {
        limit,
      },
      headers: {
        Cookie: `session=${process.env.CSFLOAT_SESSION_TOKEN}`,
      },
    }
  )

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

export const getCSFloatTrades = async ({
  role = 'buyer',
  state = 'verified',
  limit = 30,
  page = 0,
}: {
  role?: 'buyer'
  state?: 'verified'
  limit?: number
  page?: number
}): Promise<CSFloatTradesResponse> => {
  const { data } = await axios.get('https://csfloat.com/api/v1/me/trades', {
    params: { role, state, limit, page },
    headers: {
      Authorization: process.env.CSFLOAT_AUTH_KEY,
    },
  })

  return data
}

export const getPlacedOrders = async ({
  page = 0,
  limit = 10,
  order = 'desc',
}: {
  page?: number
  limit?: number
  order?: 'desc'
}): Promise<CSFloatPlacedOrders> => {
  const { data } = await axios.get('https://csfloat.com/api/v1/me/buy-orders', {
    params: { order, limit, page },
    headers: {
      Authorization: process.env.CSFLOAT_AUTH_KEY,
    },
  })

  return data
}

export const postBuyOrder = async ({
  market_hash_name,
  max_price,
  quantity = 1,
}: {
  market_hash_name: string
  max_price: number
  quantity?: number
}): Promise<CSFloatPlacedOrders> => {
  const { data } = await axios.post(
    'https://csfloat.com/api/v1/buy-orders',
    {
      max_price,
      market_hash_name,
      quantity,
    },
    {
      headers: {
        Authorization: process.env.CSFLOAT_AUTH_KEY,
      },
    }
  )

  return data
}

export const removeBuyOrder = async ({ id }: { id: string }) => {
  const { data } = await axios.delete(`https://csfloat.com/api/v1/buy-orders/${id}`, {
    headers: {
      Authorization: process.env.CSFLOAT_AUTH_KEY,
    },
  })

  return data
}
