import axios from 'axios'
import { setupCache } from 'axios-cache-interceptor'
import UserAgent from 'user-agents'
import FormData from 'form-data'

import { SteamMarketBuyListing, SteamMarketPriceHistory, SteamMarketPriceOverview, SteamMarketRender } from '../types'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { sleep } from '../utils'

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
  count = 100,
  search_descriptions = 1,
  sort_column = 'price',
  sort_dir = 'asc',
  retries = 3,
  norender = 1,
  quality = [],
  proxy,
}: {
  appid?: number
  query: string
  start?: number
  count?: number
  search_descriptions?: number
  sort_column?: 'price'
  sort_dir?: 'asc'
  norender?: number
  quality?: string[]
  retries?: number
  proxy?: string
}) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
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
          'category_730_Exterior[]': ['tag_WearCategory1', 'tag_WearCategory2'],
          'category_730_Rarity[]': [
            'tag_Rarity_Mythical_Weapon',
            'tag_Rarity_Legendary_Weapon',
            'tag_Rarity_Ancient_Weapon',
          ],
          'category_730_Weapon[]': ['any'],
          'category_730_Quality[]': quality,
        },
        headers: {
          Host: 'steamcommunity.com',
          'User-Agent': new UserAgent().toString(),
          Referer: 'https://steamcommunity.com/market/search/',
        },
        httpsAgent: proxy ? new HttpsProxyAgent(`http://${proxy}`) : undefined,
        signal: AbortSignal.timeout(5000),
        timeout: 5000,
      })

      return data
    } catch (error) {
      if (attempt === retries - 1) {
        throw error
      }

      await sleep(1_000)
    }
  }
}

export const getMarketRender = async ({
  appid = 730,
  country = 'BY',
  currency = 1,
  market_hash_name,
  start = 0,
  count = 10,
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
  userAgent?: string
  language?: 'english'
  filter?: string
  proxy?: string | 'localhost' | null
}): Promise<SteamMarketRender> => {
  const { data } = await axios.get(
    `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(market_hash_name)}/render/`,
    {
      params: { appid, country, currency, start, count, language, filter },
      headers: {
        'User-Agent': userAgent ?? new UserAgent().toString(),
        Host: 'steamcommunity.com',
        Accept: 'text/html,*/*;q=0.9',
        'Accept-Encoding': 'gzip,identity,*;q=0',
        'Accept-Charset': 'ISO-8859-1,utf-8,*;q=0.7',
        Referer: `https://steamcommunity.com/market/listings/${appid}/` + encodeURIComponent(market_hash_name),
        'X-Prototype-Version': '1.7',
        'X-Requested-With': 'XMLHttpRequest',
      },
      httpsAgent: proxy && proxy !== 'localhost' ? new HttpsProxyAgent(`http://${proxy}`) : undefined,
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
  proxy,
  retries = 3,
  filter,
}: {
  appid?: number
  market_hash_name: string
  userAgent?: string
  filter?: string
  count?: number
  retries?: number
  proxy?: string | 'localhost' | null
}) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { data } = await axios.get(
        `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(market_hash_name)}`,
        {
          params: { filter },
          headers: {
            'User-Agent': userAgent,
            Host: 'steamcommunity.com',
            Accept: 'text/html,*/*;q=0.9',
            'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,ru;q=0.7',
            Referer: `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(market_hash_name)}`,
          },
          httpsAgent: proxy && proxy !== 'localhost' ? new HttpsProxyAgent(`http://${proxy}`) : undefined,
          signal: AbortSignal.timeout(5_000),
          timeout: 5_000,
        }
      )

      return data
    } catch (error) {
      if (attempt === retries - 1) {
        throw error
      }

      await sleep(1_000)
    }
  }
}

export const stemMarketBuyListing = async ({
  idListing,
  market_hash_name,
  converted_price,
  converted_fee,
}: {
  idListing: string
  market_hash_name: string
  converted_price: number
  converted_fee: number
}): Promise<SteamMarketBuyListing> => {
  const formData = new FormData()

  formData.append('sessionid', process.env.STEAM_LISTING_SESSIONID ?? '')
  formData.append('currency', String(1))
  formData.append('subtotal', String(converted_price))
  formData.append('fee', String(converted_fee))
  formData.append('total', String(converted_price + converted_fee))
  formData.append('quantity', String(1))
  formData.append('billing_state', '')
  formData.append('save_my_address', String(0))

  const { data } = await axios.post(`https://steamcommunity.com/market/buylisting/${idListing}`, formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Host: 'steamcommunity.com',
      Origin: 'https://steamcommunity.com',
      Accept: '*/*',
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,ru;q=0.7',
      Cookie: process.env.STEAM_LISTING_COOKIE,
      Referer: `https://steamcommunity.com/market/listings/730/${encodeURIComponent(market_hash_name)}`,
    },
    httpsAgent: new HttpsProxyAgent(`http://${process.env.STEAM_LISTING_PROXY}`),
    signal: AbortSignal.timeout(10_000),
    timeout: 10_000,
  })

  return data
}
