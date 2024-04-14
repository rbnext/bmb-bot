import axios from 'axios'

import { MarketPriceOverview } from '../types'

const http = axios.create({
  baseURL: 'https://steamcommunity.com',
})

export const getMarketPriceOverview = async ({
  appid = 730,
  market_hash_name,
}: {
  appid?: number
  market_hash_name: string
}): Promise<MarketPriceOverview> => {
  const { data } = await http.get('/market/priceoverview/', {
    params: { appid, market_hash_name },
  })

  return data
}
