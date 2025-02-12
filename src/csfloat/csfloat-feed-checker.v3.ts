import 'dotenv/config'

import { getBuyOrders, getCSFloatListings, getPlacedOrders, postBuyOrder, removeBuyOrder } from '../api/csfloat'
import { median, sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import path from 'path'
import { readFileSync } from 'fs'
import { CSFloatPlacedOrder } from '../types'
import { send } from 'process'

const activeMarketOrders = new Map<string, CSFloatPlacedOrder>()
const pathname = path.join(__dirname, '../../top-float-items.json')

const BLACK_LIST = [
  'AK-47 | The Outsiders (Field-Tested)',
  'FAMAS | Commemoration (Factory New)',
  'M4A4 | The Coalition (Field-Tested)',
  'M4A4 | Desolate Space (Factory New)',
  'FAMAS | Mecha Industries (Factory New)',
  'M4A4 | 龍王 (Dragon King) (Minimal Wear)',
]

const floatFeedChecker = async () => {
  activeMarketOrders.clear()
  const response = await getPlacedOrders({ page: 0, limit: 100 })
  response.orders.forEach((order) => activeMarketOrders.set(order.market_hash_name, order))
  const mostPopularItems: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

  console.log('Blacklist size: ', BLACK_LIST.length)

  try {
    for (const market_hash_name of Object.keys(mostPopularItems)) {
      if (BLACK_LIST.includes(market_hash_name)) continue

      const response = await getCSFloatListings({ market_hash_name })
      const currentMarketOrder = activeMarketOrders.get(market_hash_name)

      const top5Items = response.data.slice(0, 5)
      const listingMedianPrice = median(top5Items.map((i) => i.price))
      const listingReferenceId = response.data[0].id

      const orders = await getBuyOrders({ id: listingReferenceId })

      const simpleOrders = orders.filter((i) => !!i.market_hash_name)

      if (simpleOrders.length === 0 || listingMedianPrice >= 3000) {
        await sleep(45_000)
        continue
      }

      const top3Orders = simpleOrders.slice(0, 3)
      const min = Math.min(...top3Orders.map((i) => i.price))
      const max = Math.max(...top3Orders.map((i) => i.price))

      if (max - min >= 10) {
        const messages: string[] = []
        const floatLink = `https://csfloat.com/search?market_hash_name=${market_hash_name}&sort_by=lowest_price&type=buy_now`
        messages.push(`⚠️ RISK ALERT <a href="${floatLink}">${market_hash_name}</a> `)
        await sendMessage(messages.join(''))

        await sleep(40_000)
        continue
      }

      const lowestOrderPrice = simpleOrders[0].price
      const estimatedMedianProfit = Number(((listingMedianPrice - lowestOrderPrice) / lowestOrderPrice) * 100)

      await sleep(20_000)

      if (currentMarketOrder) {
        if (currentMarketOrder.price < simpleOrders[0].price) {
          await removeBuyOrder({ id: currentMarketOrder.id })
        } else if (simpleOrders[0].price - simpleOrders[1].price > 1) {
          await removeBuyOrder({ id: currentMarketOrder.id })
          await postBuyOrder({ market_hash_name, max_price: Math.round(simpleOrders[1].price + 1) })
          console.log(market_hash_name, lowestOrderPrice, '->', Math.round(simpleOrders[1].price + 1))
          continue
        } else if (currentMarketOrder.price === lowestOrderPrice) {
          if (estimatedMedianProfit >= 8) continue
          else await removeBuyOrder({ id: currentMarketOrder.id })
        }
      }

      console.log(market_hash_name, listingMedianPrice, estimatedMedianProfit)

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

        await sendMessage(messages.join(''))
      }

      await sleep(45_000)
    }
  } catch (error) {
    console.log(error)
    console.log('Something went wrong:', error.message)

    if (error.message.includes('429') || error.message.includes('403') || error.message.includes('422')) {
      await sendMessage(error?.data?.message ?? 'Something went wrong.')

      return
    }
  }

  floatFeedChecker()
}

floatFeedChecker()
