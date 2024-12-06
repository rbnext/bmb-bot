import 'dotenv/config'
import { sleep } from '../utils'
import { findSteamItemInfo } from './utils'
import { MarketHashNameState, ProxyState, SteamDBItem } from '../types'
import UserAgent from 'user-agents'
import { readFileSync } from 'fs'
import path from 'path'

const pathname = path.join(__dirname, './goods.json')
const goods: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))

const PROXIES: string[] = process.env.STEAM_PROXY?.split(';').map((name) => name.trim()) as string[]

if (!Array.isArray(PROXIES)) {
  throw new Error(`PROXY env is required.`)
}

export const REQUEST_TIMEOUT = 2500
export const LINK_INTERVAL = 55000
export const PROXY_INTERVAL = 15000
export const PROXY_BAN_TIME = 120000

export const proxyState: ProxyState[] = PROXIES.map((proxy) => ({
  proxy,
  active: true,
  lastUsed: 0,
  bannedUntil: 0,
  userAgent: new UserAgent({ deviceCategory: 'desktop' }).toString(),
  isBusy: false,
}))

export const marketHashNameState: MarketHashNameState[] = Object.keys(goods).map((name) => ({
  name,
  lastRequested: 0,
  steamDataFetched: false,
  referencePrice: Number(goods[name].reference_price),
  isInProgress: false,
}))

const getNextProxy = (): string | null => {
  const now = Date.now()

  for (const proxyData of proxyState) {
    if (
      proxyData.active &&
      !proxyData.isBusy &&
      now >= proxyData.bannedUntil &&
      now - proxyData.lastUsed >= PROXY_INTERVAL
    ) {
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
  console.log('Goods:', marketHashNameState.length)
  console.log('Proxies:', proxyState.length, '\n')

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = Date.now()

    for (const linkData of marketHashNameState) {
      const timeSinceLastRequest = now - linkData.lastRequested

      if (timeSinceLastRequest >= LINK_INTERVAL && !linkData.isInProgress) {
        const proxy = getNextProxy()

        if (proxy) {
          findSteamItemInfo({ market_hash_name: linkData.name, proxy })
        }
      }
    }

    await sleep(REQUEST_TIMEOUT)
  }
}

init()
