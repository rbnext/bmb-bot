import axios from 'axios'

import { SteamMarketPriceHistory, SteamMarketPriceOverview } from '../types'

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
}): Promise<SteamMarketPriceOverview> => {
  const { data } = await http.get<SteamMarketPriceOverview>('/market/priceoverview/', {
    params: { appid, country, currency, market_hash_name },
  })

  return data
}

export const getPriceHistory = async ({
  appid = 730,
  country = 'BY',
  currency = 1,
  market_hash_name,
}: {
  appid?: number
  country?: string
  currency?: number
  market_hash_name: string
}): Promise<SteamMarketPriceHistory> => {
  const { data } = await http.get<SteamMarketPriceHistory>('/market/pricehistory/', {
    params: { appid, country, currency, market_hash_name },
    headers: {
      Cookie: `steamLoginSecure=${process.env.STEAM_LOGIN_SECURE}`,
    },
  })

  return data
}
