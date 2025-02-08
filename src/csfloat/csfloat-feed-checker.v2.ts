import 'dotenv/config'

import {
  getBuyOrders,
  getCSFloatListings,
  getCSFloatSimpleOrders,
  getMarketHashNameHistory,
  getPlacedOrders,
  postBuyOrder,
  removeBuyOrder,
} from '../api/csfloat'
import { differenceInHours, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { sleep } from '../utils'
import { CSFloatMarketHashNameHistory, CSFloatPlacedOrder } from '../types'
import { sendMessage } from '../api/telegram'
import path from 'path'
import { readFileSync, writeFileSync } from 'fs'

const blacklistedMarketListings = new Set<string>()
const activeMarketOrders = new Map<string, CSFloatPlacedOrder>()
const baseItemPriceCache = new Map<string, number>()
const marketHistoryCache = new Map<string, CSFloatMarketHashNameHistory[]>()
const pathname = path.join(__dirname, '../../top-float-items.json')

const getMarketHistory = async ({
  market_hash_name,
}: {
  market_hash_name: string
}): Promise<CSFloatMarketHashNameHistory[]> => {
  const data = marketHistoryCache.get(market_hash_name)
  if (data) return data

  const response = await getMarketHashNameHistory({ market_hash_name })
  marketHistoryCache.set(market_hash_name, response)

  return response
}

const floatFeedChecker = async () => {
  try {
    const response = await getCSFloatListings({
      sort_by: 'most_recent',
      min_price: 900,
      max_price: 9000,
      max_float: 0.5,
    })

    for (const item of response.data) {
      const topList: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))
      const market_hash_name = item.item.market_hash_name
      const pathname1 = path.join(__dirname, '../../float.json')
      const floatBlackList: string[] = JSON.parse(readFileSync(pathname1, 'utf8'))
      const itemQuantity = item.reference.quantity
      const baseItemPrice = item.reference.base_price / 100

      if (
        baseItemPrice < 9 ||
        floatBlackList.includes(market_hash_name) ||
        blacklistedMarketListings.has(item.id) ||
        itemQuantity < 30 ||
        topList[market_hash_name]
      ) {
        continue
      }

      const marketHistoryResponse = await getMarketHistory({ market_hash_name })
      const sales48h = marketHistoryResponse.filter((item) => {
        return differenceInHours(new Date(), toZonedTime(item.sold_at, 'Europe/Warsaw')) < 24 * 2
      })

      blacklistedMarketListings.add(item.id)

      if (sales48h.length > 15) {
        const floatBlackList: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))
        writeFileSync(pathname, JSON.stringify({ ...floatBlackList, [market_hash_name]: itemQuantity }, null, 4))
        await sleep(10_000)
        console.log(market_hash_name, sales48h.length)
        continue
      }

      await sleep(5_000)
    }
  } catch (error) {
    console.log('Something went wrong:', error.message)

    if (error.message.includes('429')) {
      await sendMessage(error?.message ?? 'Something went wrong.')

      return
    }
  }

  await sleep(5_000)
  console.log('круг')

  floatFeedChecker()
}

floatFeedChecker()
