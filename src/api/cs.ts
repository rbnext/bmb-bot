import axios from 'axios'

import { CSMoneyResponse } from '../types'

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
  sort = 'insertDate',
}: {
  minPrice?: number
  maxPrice?: number
  limit?: number
  offset?: number
  order?: string
  sort?: string
}): Promise<CSMoneyResponse> => {
  const { data } = await http.get('/market/sell-orders', {
    params: {
      limit,
      offset,
      order,
      sort,
      minPrice,
      maxPrice,
    },
    headers: {
      Cookie: `${process.env.CS_MONEY_TOKEN}`,
    },
  })

  return data
}
