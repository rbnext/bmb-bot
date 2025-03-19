import 'dotenv/config'

import {
  getBuyOrders,
  getCSFloatListings,
  getCSFloatTrades,
  getPlacedOrders,
  postBuyOrder,
  removeBuyOrder,
} from '../api/csFloat'
import { median, sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import path from 'path'
import { readFileSync } from 'fs'
import { CSFloatPlacedOrder } from '../types'
import { format, isAfter, subHours } from 'date-fns'

const activeMarketOrders = new Map<string, CSFloatPlacedOrder>()
const pathname = path.join(__dirname, '../../top-float-items.json')

const orderBlackList = new Set<string>()

const floatFeedChecker = async () => {
  activeMarketOrders.clear()

  const response = await getPlacedOrders({ page: 0, limit: 100 })
  const verifiedTrades = await getCSFloatTrades({ page: 0, limit: 100 })

  response.orders.forEach((order) => activeMarketOrders.set(order.market_hash_name, order))
  const mostPopularItems: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

  for (const item of verifiedTrades.trades) {
    if (isAfter(item.created_at, subHours(new Date(), 24))) {
      orderBlackList.add(item.contract.item.market_hash_name)
    }
  }

  console.log('Blacklist size: ', orderBlackList.size)

  try {
    for (const market_hash_name of Object.keys(mostPopularItems)) {
      if (orderBlackList.has(market_hash_name)) continue

      const now = format(new Date(), 'HH:mm:ss')

      const response = await getCSFloatListings({ market_hash_name })
      const currentMarketOrder = activeMarketOrders.get(market_hash_name)

      const top5Items = response.data.slice(0, 5)
      const listingMedianPrice = median(top5Items.map((i) => i.price))
      const listingReferenceId = response.data[0].id

      const orders = await getBuyOrders({ id: listingReferenceId })
      const simpleOrders = orders.filter((i) => !!i.market_hash_name)

      const currentPrice = response.data[0].price
      const predictedPrice = response.data[0].reference.predicted_price
      const overpayment = Number((((currentPrice - predictedPrice) / predictedPrice) * 100).toFixed(2))

      if (overpayment > 5) {
        console.log(now, market_hash_name, 'Overpayment is too high', overpayment)
        await sleep(30_000)
        continue
      }

      if (simpleOrders.length < 3) {
        console.log(now, market_hash_name, 'There are less than 3 orders')
        await sleep(30_000)
        continue
      }

      await sleep(10_000)

      const lowestOrderPrice = simpleOrders[0].price
      const estimatedMedianProfit = Number(((listingMedianPrice - lowestOrderPrice) / lowestOrderPrice) * 100)

      console.log(now, market_hash_name, estimatedMedianProfit.toFixed(2) + '%')

      if (currentMarketOrder) {
        if (currentMarketOrder.price < simpleOrders[0].price) {
          await removeBuyOrder({ id: currentMarketOrder.id })
        } else if (simpleOrders[0].price - simpleOrders[1].price > 1) {
          await removeBuyOrder({ id: currentMarketOrder.id })
          await postBuyOrder({ market_hash_name, max_price: Math.round(simpleOrders[1].price + 1) })
          console.log(now, market_hash_name, lowestOrderPrice, '->', Math.round(simpleOrders[1].price + 1))
          continue
        } else if (currentMarketOrder.price === lowestOrderPrice) {
          if (estimatedMedianProfit >= 8) continue
          else await removeBuyOrder({ id: currentMarketOrder.id })
        }
      }

      if (estimatedMedianProfit >= 8) {
        await postBuyOrder({ market_hash_name, max_price: Math.round(lowestOrderPrice + 1) }).then(() => sleep(5_000))
        const floatLink = `https://csfloat.com/search?market_hash_name=${market_hash_name}&sort_by=lowest_price&type=buy_now`

        const messages: string[] = []

        messages.push('<b>[FLOAT ORDER]</b> ')
        messages.push(`<a href="${floatLink}">${market_hash_name}</a> `)
        if (currentMarketOrder) messages.push(`$${currentMarketOrder.price / 100} -> $${(lowestOrderPrice + 1) / 100}`)
        else {
          const medianProfit = estimatedMedianProfit.toFixed(2)
          const medianPrice = (listingMedianPrice / 100).toFixed(2)

          messages.push(`Profit ~${medianProfit}% / Order: ${(lowestOrderPrice + 1) / 100} / Median: $${medianPrice}`)
        }

        await sendMessage({ text: messages.join(''), chat_id: process.env.TELEGRAM_CSFLOAT_CHAT_ID })
      }

      await sleep(20_000)
    }
  } catch (error) {
    console.log(error)
    console.log('Something went wrong:', error.message)

    if (error.message.includes('429') || error.message.includes('403') || error.message.includes('422')) {
      await sendMessage({ text: error?.data?.message ?? 'Something went wrong.' })

      return
    }
  }

  floatFeedChecker()
}

floatFeedChecker()
