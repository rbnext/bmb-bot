import axios from 'axios'
import { setupCache } from 'axios-cache-interceptor'
import UserAgent from 'user-agents'

import { SearchMarketRender, SteamMarketPriceHistory, SteamMarketPriceOverview, SteamMarketRender } from '../types'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { getRandomNumber } from '../utils'

const instance = axios.create({
  baseURL: 'https://steamcommunity.com',
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
})

const http = setupCache(instance)

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
    cache: {
      ttl: 1000 * 60 * 60, // 1 hour
    },
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
    cache: {
      ttl: 1000 * 60 * 60, // 1 hour
    },
  })

  return data
}

export const getSearchMarketRender = async ({
  appid = 730,
  query,
  start = 0,
  count = 60,
  search_descriptions = 1,
  sort_column = 'price',
  sort_dir = 'asc',
  norender = 1,
  type,
}: {
  appid?: number
  query: string
  start?: number
  count?: number
  search_descriptions?: number
  sort_column?: 'price'
  sort_dir?: 'asc'
  norender?: number
  type: string
}): Promise<SearchMarketRender> => {
  const userAgent = new UserAgent()
  const PORT = getRandomNumber(10000, 10999)

  const { data } = await axios.get(`https://steamcommunity.com/market/search/render/`, {
    params: {
      appid,
      query,
      start,
      count,
      search_descriptions,
      sort_column,
      sort_dir,
      norender,
      'category_730_Exterior[]': ['tag_WearCategory0', 'tag_WearCategory1', 'tag_WearCategory2'],
      'category_730_Quality[]': ['tag_normal'],
      'category_730_Rarity[]': [
        'tag_Rarity_Mythical_Weapon',
        'tag_Rarity_Legendary_Weapon',
        'tag_Rarity_Ancient_Weapon',
      ],
      'category_730_Weapon[]': [type],
      ...(type !== 'any' && {
        'category_730_Type[]': ['tag_CSGO_Type_Rifle'],
      }),
    },
    headers: {
      Host: 'steamcommunity.com',
      'User-Agent': userAgent.toString(),
      Referer: 'https://steamcommunity.com/market/search/',
    },
    httpsAgent: new HttpsProxyAgent(`${process.env.POOL_PROXY_URL}:${PORT}`),
    timeout: 3000,
  })

  return data
}

export const getMarketRender = async ({
  appid = 730,
  country = 'BY',
  currency = 1,
  market_hash_name,
  start = 0,
  count = 5,
  language = 'english',
  userAgent,
  filter,
  proxy,
}: {
  appid?: number
  country?: string
  currency?: number
  market_hash_name: string
  start?: number
  count?: number
  userAgent: string
  language?: 'english'
  filter?: string
  proxy: string | 'localhost' | null
}): Promise<SteamMarketRender> => {
  const { data } = await axios.get(
    `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(market_hash_name)}/render/`,
    {
      params: { appid, country, currency, start, count, language, filter },
      headers: {
        'User-Agent': userAgent,
        Host: 'steamcommunity.com',
        Accept: 'text/html,*/*;q=0.9',
        'Accept-Encoding': 'gzip,identity,*;q=0',
        'Accept-Charset': 'ISO-8859-1,utf-8,*;q=0.7',
        Referer: `https://steamcommunity.com/market/listings/${appid}/` + encodeURIComponent(market_hash_name),
        'X-Prototype-Version': '1.7',
        'X-Requested-With': 'XMLHttpRequest',
      },
      httpsAgent: proxy && proxy !== 'localhost' ? new HttpsProxyAgent(proxy) : undefined,
      signal: AbortSignal.timeout(5000),
      timeout: 5000,
    }
  )

  return data
}

export const getMarketPage = async ({
  appid = 730,
  market_hash_name,
  userAgent,
  count = 10,
  proxy,
}: {
  appid?: number
  market_hash_name: string
  userAgent?: string
  filter?: string
  count?: number
  proxy?: string | 'localhost' | null
}): Promise<string> => {
  const { data } = await axios.get(
    `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(market_hash_name)}`,
    {
      headers: {
        'User-Agent': userAgent,
        Host: 'steamcommunity.com',
        Accept: 'text/html,*/*;q=0.9',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,ru;q=0.7',
      },
      httpsAgent: proxy && proxy !== 'localhost' ? new HttpsProxyAgent(`http://${proxy}`) : undefined,
      signal: AbortSignal.timeout(10_000),
      timeout: 10_000,
    }
  )

  return data
}
