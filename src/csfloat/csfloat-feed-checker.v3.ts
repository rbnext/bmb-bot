import 'dotenv/config'

import { getBuyOrders, getCSFloatListings, getPlacedOrders, postBuyOrder, removeBuyOrder } from '../api/csfloat'
import { sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import path from 'path'
import { readFileSync } from 'fs'
import { CSFloatPlacedOrder } from '../types'

const activeMarketOrders = new Map<string, CSFloatPlacedOrder>()
const pathname = path.join(__dirname, '../../top-float-items.json')

const BLACK_LIST = ['AK-47 | The Outsiders (Field-Tested)']

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

      const listingReferenceId = response.data[0].id
      const listingPrice = Number((response.data[0].price / 100).toFixed(2))
      const listingBasePrice = Number((response.data[0].reference.base_price / 100).toFixed(2))

      const orders = await getBuyOrders({ id: listingReferenceId })

      const simpleOrders = orders.filter((i) => !!i.market_hash_name)

      if (simpleOrders.length === 0) {
        await sleep(45_000)
        continue
      }

      const lowestOrderPrice = Number((simpleOrders[0].price / 100).toFixed(2))
      const estimatedBaseProfit = Number((((listingBasePrice - lowestOrderPrice) / lowestOrderPrice) * 100).toFixed(2))
      const estimatedPriceProfit = Number((((listingPrice - lowestOrderPrice) / lowestOrderPrice) * 100).toFixed(2))

      console.log(market_hash_name, estimatedBaseProfit, estimatedPriceProfit)

      await sleep(10_000)

      if (estimatedBaseProfit <= 1 && !BLACK_LIST.includes(market_hash_name)) {
        BLACK_LIST.push(market_hash_name)
      }

      if (currentMarketOrder) {
        const lowestPrice = Math.round(lowestOrderPrice * 100)
        console.log(`${market_hash_name}. Current/Lowest price: $${currentMarketOrder.price}/${lowestPrice}`)
        if (currentMarketOrder.price < lowestPrice) await removeBuyOrder({ id: currentMarketOrder.id })
        else if (currentMarketOrder.price === lowestPrice) continue
      }

      if (estimatedBaseProfit >= 7 && estimatedPriceProfit >= 7) {
        const maxOrderPrice = Math.round((lowestOrderPrice + 0.01) * 100)
        await postBuyOrder({ market_hash_name, max_price: maxOrderPrice }).then(() => sleep(5_000))
        const floatLink = `https://csfloat.com/search?market_hash_name=${market_hash_name}&sort_by=lowest_price&type=buy_now`

        const messages: string[] = []

        messages.push('<b>[FLOAT ORDER]</b> ')
        messages.push(`<a href="${floatLink}">${market_hash_name}</a> `)
        if (currentMarketOrder) messages.push(`$${currentMarketOrder.price / 100} -> $${maxOrderPrice / 100}`)
        else messages.push(`Profit ~${estimatedBaseProfit}% Order price: ${maxOrderPrice / 100}`)

        await sendMessage(messages.join(''))
      }

      await sleep(45_000)
    }
  } catch (error) {
    console.log(error)
    console.log('Something went wrong:', error.message)

    if (error.message.includes('429')) {
      await sendMessage(error?.message ?? 'Something went wrong.')

      return
    }
  }

  floatFeedChecker()
}

floatFeedChecker()
