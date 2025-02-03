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
import { median, sleep } from '../utils'
import { CSFloatMarketHashNameHistory, CSFloatPlacedOrder } from '../types'
import { sendMessage } from '../api/telegram'

const blacklistedMarketOrders = new Set<string>()
const blacklistedMarketListings = new Set<string>()
const activeMarketOrders = new Map<string, CSFloatPlacedOrder>()
const marketHistoryCache = new Map<string, CSFloatMarketHashNameHistory[]>()

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
  await syncMarketOrders()

  const response = await getCSFloatListings({
    sort_by: 'most_recent',
    min_price: 900,
    max_price: 6000,
    max_float: 0.45,
  })

  for (const item of response.data) {
    const now = format(new Date(), 'HH:mm:ss')
    const market_hash_name = item.item.market_hash_name
    const activeMarketOrder = activeMarketOrders.get(market_hash_name)

    if (blacklistedMarketOrders.has(market_hash_name)) continue
    if (blacklistedMarketListings.has(item.id)) continue

    const baseItemPrice = item.reference.base_price / 100

    if (baseItemPrice < 9) blacklistedMarketOrders.add(market_hash_name)
    if (baseItemPrice < 9) continue

    const marketHistoryResponse = await getMarketHistory({ market_hash_name })
    const medianPrice = median(marketHistoryResponse.map((item) => item.price / 100))
    const sales48h = marketHistoryResponse.filter((item) => {
      return differenceInHours(new Date(), toZonedTime(item.sold_at, 'Europe/Warsaw')) < 24 * 2
    })

    if (sales48h.length < 10 || medianPrice < 9) await sleep(10_000)
    if (sales48h.length < 10 || medianPrice < 9) blacklistedMarketOrders.add(market_hash_name)
    if (sales48h.length < 10 || medianPrice < 9) continue

    if (activeMarketOrder) {
      const listingReferenceId = marketHistoryResponse.sort((a, b) => a.price - b.price)[0].id
      const resentOrders = await getBuyOrders({ id: listingReferenceId })
      const simpleOrders = resentOrders.filter((i) => !!i.market_hash_name)
      if (simpleOrders[0].market_hash_name === market_hash_name && simpleOrders[0].price > activeMarketOrder.price) {
        await removeBuyOrder({ id: activeMarketOrder.id })
        activeMarketOrders.delete(market_hash_name)
        console.log(
          `Order ${market_hash_name} has been removed. Prev price: ${activeMarketOrder.price}, new price: ${simpleOrders[0].price}`
        )
      }

      await sleep(10_000)

      continue
    }

    const simpleOrders = await getCSFloatSimpleOrders({ market_hash_name })

    await sleep(5_000)

    const lowestOrderPrice = Number((simpleOrders.data[0].price / 100).toFixed(2))
    const estimatedProfit = Number((((baseItemPrice - lowestOrderPrice) / lowestOrderPrice) * 100).toFixed(2))
    const maxOrderPrice = Math.round((lowestOrderPrice + 0.01) * 100)

    console.log(now, market_hash_name, estimatedProfit + '%')

    if (estimatedProfit >= 9) {
      await postBuyOrder({ market_hash_name, max_price: maxOrderPrice }).then(() => sleep(10_000))
      const firstCreatedOrders = await getPlacedOrders({ order: 'asc' })
      await removeBuyOrder({ id: firstCreatedOrders.orders[0].id })
      await sendMessage(
        `<b>[CSFLOAT ORDER]</b> <a href="https://csfloat.com/search?market_hash_name=${market_hash_name}&sort_by=lowest_price&type=buy_now">${market_hash_name}</a> Estimated profit: ${estimatedProfit}%. Order: ${(maxOrderPrice / 100).toFixed(2)}`
      )
      await syncMarketOrders()
    }

    blacklistedMarketListings.add(item.id)

    await sleep(30_000)
  }

  await sleep(200_000)

  floatFeedChecker()
}

floatFeedChecker()
