import 'dotenv/config'

import { getBuyOrders, getCSFloatListings, getPlacedOrders, postBuyOrder, removeBuyOrder } from '../api/csfloat'
import { median, sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import path from 'path'
import { readFileSync } from 'fs'
import { CSFloatPlacedOrder } from '../types'
import { getGoodsSellOrder } from '../api/buff'
import { format } from 'date-fns'

const activeMarketOrders = new Map<string, CSFloatPlacedOrder>()
const pathname = path.join(__dirname, '../../top-float-items.json')

const BLACK_LIST: string[] = []

const floatFeedChecker = async () => {
  activeMarketOrders.clear()
  const response = await getPlacedOrders({ page: 0, limit: 100 })
  response.orders.forEach((order) => activeMarketOrders.set(order.market_hash_name, order))
  const mostPopularItems: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

  console.log('Blacklist size: ', BLACK_LIST.length)

  try {
    for (const market_hash_name of Object.keys(mostPopularItems)) {
      if (BLACK_LIST.includes(market_hash_name)) continue

      const now = format(new Date(), 'HH:mm:ss')

      const response = await getCSFloatListings({ market_hash_name })
      const currentMarketOrder = activeMarketOrders.get(market_hash_name)

      const top5Items = response.data.slice(0, 5)
      const listingMedianPrice = median(top5Items.map((i) => i.price))
      const listingReferenceId = response.data[0].id
      const listingBasePrice = response.data[0].reference.base_price

      const orders = await getBuyOrders({ id: listingReferenceId })
      const simpleOrders = orders.filter((i) => !!i.market_hash_name)

      if (simpleOrders.length < 3 || listingBasePrice < 1000) {
        console.log(now, market_hash_name, 'There are less than 3 orders')
        await sleep(10_000)
        continue
      }

      const top3Orders = simpleOrders.slice(0, 3)
      const min = Math.min(...top3Orders.map((i) => i.price))
      const max = Math.max(...top3Orders.map((i) => i.price))

      if (max - min >= 25) {
        console.log(now, market_hash_name, 'There is a big gap between top 3 orders')

        if (currentMarketOrder) {
          console.log(now, market_hash_name, 'Removing order due to big gap')
          await removeBuyOrder({ id: currentMarketOrder.id })
        }

        await sleep(20_000)
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

;(async () => {
  const response = await getPlacedOrders({ page: 0, limit: 100 })

  for (const order of response.orders) {
    await removeBuyOrder({ id: order.id })
    await sleep(5000)
  }

  floatFeedChecker()
})()
