import 'dotenv/config'
import { sleep } from '../utils'
import { findSteamItemInfo } from './utils'
import { MarketHashNameState, ProxyState } from '../types'
import UserAgent from 'user-agents'
import { getGoodsInfo, getMarketGoods } from '../api/buff'

const PROXIES: string[] = process.env.STEAM_PROXY?.split(';').map((name) => name.trim()) as string[]
const MARKET_HASH_NAMES = process.env.STEAM_MARKET_HASH_NAMES?.split(';').map((name) => name.trim()) as string[]

if (!Array.isArray(PROXIES) || !Array.isArray(MARKET_HASH_NAMES)) {
  throw new Error(`PROXY and MARKET_HASH_NAMES env's are required.`)
}

export const REQUEST_TIMEOUT = 2500
export const LINK_INTERVAL = 60000
export const PROXY_INTERVAL = 15000
export const PROXY_BAN_TIME = 120000

export const proxyState: ProxyState[] = PROXIES.map((proxy) => ({
  proxy,
  active: true,
  lastUsed: 0,
  bannedUntil: 0,
}))

export const marketHashNameState: MarketHashNameState[] = MARKET_HASH_NAMES.map((name) => ({
  name,
  lastRequested: 0,
  steamDataFetched: false,
  referencePrice: 0,
  userAgent: '',
}))

const getNextProxy = (): string | null => {
  const now = Date.now()

  for (const proxyData of proxyState) {
    if (proxyData.active && now >= proxyData.bannedUntil && now - proxyData.lastUsed >= PROXY_INTERVAL) {
      proxyData.lastUsed = now

      return proxyData.proxy
    }

    if (!proxyData.active && now >= proxyData.bannedUntil) {
      proxyData.active = true
      proxyData.bannedUntil = 0
    }
  }

  return null
}

async function init(): Promise<void> {
  for (const config of marketHashNameState) {
    const userAgent = new UserAgent().toString()

    const goods = await getMarketGoods({ search: config.name })
    const goods_id = goods.data.items.find((el) => el.market_hash_name === config.name)?.id

    if (goods_id) {
      const goodsInfo = await getGoodsInfo({ goods_id })
      const referencePrice = Number(goodsInfo.data.goods_info.goods_ref_price)

      config.userAgent = userAgent
      config.referencePrice = referencePrice
    } else {
      throw new Error(`Item ${config.name} is not valid.`)
    }

    await sleep(5_000)
  }

  while (true) {
    const now = Date.now()

    for (const linkData of marketHashNameState) {
      const timeSinceLastRequest = now - linkData.lastRequested

      if (timeSinceLastRequest >= LINK_INTERVAL) {
        const proxy = getNextProxy()

        if (proxy) {
          findSteamItemInfo({ market_hash_name: linkData.name, proxy: proxy })
        }
      }
    }

    await sleep(REQUEST_TIMEOUT)
  }
}

init()
