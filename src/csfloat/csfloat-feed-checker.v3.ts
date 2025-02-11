import 'dotenv/config'

import { getBuyOrders, getCSFloatListings, getPlacedOrders, postBuyOrder, removeBuyOrder } from '../api/csfloat'
import { median, sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import path from 'path'
import { readFileSync } from 'fs'
import { CSFloatPlacedOrder } from '../types'

const activeMarketOrders = new Map<string, CSFloatPlacedOrder>()
const pathname = path.join(__dirname, '../../top-float-items.json')

const BLACK_LIST = [
  'AK-47 | The Outsiders (Field-Tested)',
  'FAMAS | Commemoration (Factory New)',
  'M4A4 | The Coalition (Field-Tested)',
  'M4A4 | Desolate Space (Factory New)',
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

      if (simpleOrders.length === 0) {
        await sleep(45_000)
        continue
      }

      const lowestOrderPrice = simpleOrders[0].price
      const estimatedMedianProfit = Number(((listingMedianPrice - lowestOrderPrice) / lowestOrderPrice) * 100)

      await sleep(10_000)

      if (currentMarketOrder) {
        if (currentMarketOrder.price < simpleOrders[0].price) {
          await removeBuyOrder({ id: currentMarketOrder.id })
        } else if (simpleOrders[0].price - simpleOrders[1].price > 1) {
          await removeBuyOrder({ id: currentMarketOrder.id })
          await postBuyOrder({ market_hash_name, max_price: Math.round(simpleOrders[1].price + 1) })
          console.log(market_hash_name, lowestOrderPrice, '->', Math.round(simpleOrders[1].price + 1))
          continue
        } else if (currentMarketOrder.price === lowestOrderPrice) {
          if (estimatedMedianProfit >= 7) continue
          else await removeBuyOrder({ id: currentMarketOrder.id })
        }
      }

      console.log(market_hash_name, listingMedianPrice, estimatedMedianProfit)

      if (estimatedMedianProfit >= 7) {
        await postBuyOrder({ market_hash_name, max_price: Math.round(lowestOrderPrice + 1) }).then(() => sleep(5_000))
        const floatLink = `https://csfloat.com/search?market_hash_name=${market_hash_name}&sort_by=lowest_price&type=buy_now`

        const messages: string[] = []

        messages.push('<b>[FLOAT ORDER]</b> ')
        messages.push(`<a href="${floatLink}">${market_hash_name}</a> `)
        if (currentMarketOrder) messages.push(`$${currentMarketOrder.price / 100} -> $${(lowestOrderPrice + 1) / 100}`)
        else messages.push(`Profit ~${estimatedMedianProfit}% Order price: ${(lowestOrderPrice + 1) / 100}`)

        await sendMessage(messages.join(''))
      }

      await sleep(45_000)
    }
  } catch (error) {
    console.log(error)
    console.log('Something went wrong:', error.message)

    if (error.message.includes('429') || error.message.includes('403')) {
      await sendMessage(error?.message ?? 'Something went wrong.')

      return
    }
  }

  floatFeedChecker()
}

floatFeedChecker()
