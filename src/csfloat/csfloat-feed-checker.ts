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
const pathname = path.join(__dirname, '../../float.json')

const blackList = [
  'USP-S | Jawbreaker (Minimal Wear)',
  'AK-47 | The Outsiders (Field-Tested)',
  'AK-47 | The Outsiders (Minimal Wear)',
]

const syncMarketOrders = async () => {
  activeMarketOrders.clear()

  for (const page of [0, 1]) {
    const response = await getPlacedOrders({ page, limit: 100 })
    response.orders.forEach((order) => {
      activeMarketOrders.set(order.market_hash_name, order)
    })
    if (response.count !== 100) break
    await sleep(5_000)
  }
}

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
    await syncMarketOrders()

    const response = await getCSFloatListings({
      sort_by: 'most_recent',
      min_price: 900,
      max_price: 9000,
      max_float: 0.5,
    })

    for (const item of response.data) {
      const now = format(new Date(), 'HH:mm:ss')
      const market_hash_name = item.item.market_hash_name
      const floatBlackList: string[] = JSON.parse(readFileSync(pathname, 'utf8'))
      const itemQuantity = item.reference.quantity
      const baseItemPrice = item.reference.base_price / 100

      if (activeMarketOrders.get(market_hash_name)) {
        baseItemPriceCache.set(market_hash_name, baseItemPrice)
      }

      if (
        baseItemPrice < 9 ||
        activeMarketOrders.get(market_hash_name) ||
        floatBlackList.includes(market_hash_name) ||
        blacklistedMarketListings.has(item.id) ||
        blackList.includes(market_hash_name) ||
        itemQuantity < 30
      ) {
        continue
      }

      const marketHistoryResponse = await getMarketHistory({ market_hash_name })
      const sales48h = marketHistoryResponse.filter((item) => {
        return differenceInHours(new Date(), toZonedTime(item.sold_at, 'Europe/Warsaw')) < 24 * 2
      })

      if (sales48h.length < 10) {
        const floatBlackList: string[] = JSON.parse(readFileSync(pathname, 'utf8'))
        writeFileSync(pathname, JSON.stringify([...floatBlackList, market_hash_name], null, 4))
        await sleep(10_000)
        continue
      }

      const simpleOrders = await getCSFloatSimpleOrders({ market_hash_name })

      await sleep(5_000)

      const lowestOrderPrice = Number((simpleOrders.data[0].price / 100).toFixed(2))
      const estimatedProfit = Number((((baseItemPrice - lowestOrderPrice) / lowestOrderPrice) * 100).toFixed(2))
      const maxOrderPrice = Math.round((lowestOrderPrice + 0.01) * 100)

      console.log(now, market_hash_name, estimatedProfit + '%')

      if (estimatedProfit >= 7) {
        await postBuyOrder({ market_hash_name, max_price: maxOrderPrice }).then(() => sleep(10_000))
        await sendMessage(
          `<b>[CSFLOAT ORDER]</b> <a href="https://csfloat.com/search?market_hash_name=${market_hash_name}&sort_by=lowest_price&type=buy_now">${market_hash_name}</a> Estimated profit: ${estimatedProfit}%. Order: ${(maxOrderPrice / 100).toFixed(2)}`
        )
        await syncMarketOrders()
      }

      blacklistedMarketListings.add(item.id)

      await sleep(30_000)
    }
  } catch (error) {
    console.log('Something went wrong:', error.message)

    if (error.message.includes('429')) {
      await sendMessage(error?.message ?? 'Something went wrong.')

      return
    }
  }

  await sleep(60_000 * 10)

  console.log(format(new Date(), 'HH:mm:ss'), 'Checking orders')

  for (const [market_hash_name, order] of activeMarketOrders) {
    const historyCache = marketHistoryCache.get(market_hash_name)
    const baseItemPrice = baseItemPriceCache.get(market_hash_name)

    if (historyCache && baseItemPrice) {
      const listingReferenceId = historyCache.sort((a, b) => a.price - b.price)[0].id
      const resentOrders = await getBuyOrders({ id: listingReferenceId })
      const simpleOrders = resentOrders.filter((i) => !!i.market_hash_name)

      const lowestOrderPrice = Number((simpleOrders[0].price / 100).toFixed(2))
      const estimatedProfit = Number((((baseItemPrice - lowestOrderPrice) / lowestOrderPrice) * 100).toFixed(2))
      const maxOrderPrice = Math.round((lowestOrderPrice + 0.01) * 100)

      await sleep(5_000)

      if (simpleOrders[0].price > order.price) {
        await removeBuyOrder({ id: order.id })

        if (estimatedProfit >= 7) {
          await postBuyOrder({ market_hash_name, max_price: maxOrderPrice }).then(() => sleep(5_000))
          await sendMessage(
            `<b>[CSFLOAT ORDER]</b> <a href="https://csfloat.com/search?market_hash_name=${market_hash_name}&sort_by=lowest_price&type=buy_now">${market_hash_name}</a> $${(order.price / 100).toFixed(2)} -> $${(maxOrderPrice / 100).toFixed(2)}`
          )
        }
      }

      await sleep(5_000)
    }
  }

  await sleep(5_000)

  floatFeedChecker()
}

floatFeedChecker()
