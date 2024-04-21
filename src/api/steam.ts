import axios from 'axios'

import { MarketPriceOverview } from '../types'

const http = axios.create({
  baseURL: 'https://steamcommunity.com',
})

export const getMarketPriceOverview = async ({
  appid = 730,
  country = 'BY',
  currency = 1,
  market_hash_name,
}: {
  appid?: number
  country?: string
  currency?: number
  market_hash_name: string
}): Promise<MarketPriceOverview> => {
  const { data } = await http.get<MarketPriceOverview>('/market/priceoverview/', {
    params: { appid, country, currency, market_hash_name },
  })

  return data
}
