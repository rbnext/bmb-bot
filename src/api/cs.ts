import axios from 'axios'

import { CSMoneyPurchase, CSMoneyResponse } from '../types'

const http = axios.create({
  baseURL: 'https://cs.money/1.0',
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
})

export const getCSMoneyListings = async ({
  minPrice,
  maxPrice,
  limit = 60,
  offset = 0,
  order = 'desc',
  quality = ['fn', 'mw', 'ft', 'ww', 'bs'],
  sort = 'insertDate',
}: {
  minPrice?: number
  maxPrice?: number
  limit?: number
  offset?: number
  order?: string
  sort?: string
  quality?: string[]
}): Promise<CSMoneyResponse> => {
  const { data } = await http.get('/market/sell-orders', {
    params: {
      limit,
      offset,
      order,
      sort,
      minPrice,
      maxPrice,
      quality,
    },
    headers: {
      Cookie: `${process.env.CS_MONEY_TOKEN}`,
    },
  })

  return data
}

export const csMoneyPurchase = async (payload: { items: CSMoneyPurchase[] }) => {
  const { data } = await http.post('/market/purchase', payload, {
    headers: {
      origin: 'https://cs.money',
      Cookie: `${process.env.CS_MONEY_TOKEN_PROD}`,
    },
  })

  return data
}

export const csMoneyAddToCart = async (payload: { items: CSMoneyPurchase[] }) => {
  const { data } = await http.post('/market/cart/items', payload, {
    headers: {
      origin: 'https://cs.money',
      Cookie: `${process.env.CS_MONEY_TOKEN_PROD}`,
    },
  })

  console.log(data)

  return data
}
