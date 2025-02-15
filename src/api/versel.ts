import axios from 'axios'
import { MapSteamMarketRenderResponse } from '../types'

export const getVercelMarketRender = async ({
  market_hash_name,
  start = 0,
  count = 10,
  proxy,
  filter,
}: {
  market_hash_name: string
  start?: number
  count?: number
  proxy: string
  filter?: string
}): Promise<MapSteamMarketRenderResponse[]> => {
  const params = `start=${start}&count=${count}&country=BY&language=english&currency=1&filter=${filter ?? ''}`

  const { data } = await axios.post(`https://${proxy}.vercel.app/api`, {
    url: `https://steamcommunity.com/market/listings/730/${encodeURIComponent(market_hash_name)}/render?${params}`,
  })

  return data
}

export const getVercelSearchMarketRender = async ({
  query,
  start = 0,
  count = 100,
  quality = [],
  exterior = ['tag_WearCategory1', 'tag_WearCategory2'],
  proxy,
}: {
  query?: string
  start?: number
  count?: number
  quality?: string[]
  exterior?: string[]
  proxy?: string
}) => {
  const exteriorQuery = `${exterior.map((q) => `category_730_Exterior[]=${encodeURIComponent(q)}`).join('&')}`

  const params = `appid=730&query=${query ?? ''}&start=${start}&count=${count}&search_descriptions=1&sort_column=price&sort_dir=asc&norender=1&${exteriorQuery}&category_730_Rarity[]=tag_Rarity_Mythical_Weapon&category_730_Rarity[]=tag_Rarity_Legendary_Weapon&category_730_Rarity[]=tag_Rarity_Ancient_Weapon&category_730_Weapon[]=any${quality.map((q) => `&category_730_Quality[]=${encodeURIComponent(q)}`).join('')}`

  const { data } = await axios.post(`https://${proxy}.vercel.app/api`, {
    url: `https://steamcommunity.com/market/search/render?${params}`,
  })

  return data
}
