import 'dotenv/config'

import { getCSFloatItemPrice, sleep } from '../utils'
import { getBuyOrders, getCSFloatListings, getPlacedOrders, postBuyOrder } from '../api/csfloat'
import { sendMessage } from '../api/telegram'
import { CSFloatPlacedOrder } from '../types'

const checkedMarketOrders = new Set<string>()
const activeMarketOrders = new Map<string, CSFloatPlacedOrder>()

const csFloatBuyOrders = async () => {
  const pages = Array.from({ length: 5 }, (_, i) => i)

  for (const page of pages) {
    const response = await getPlacedOrders({ page, limit: 100 })
    response.orders.forEach((order) => {
      checkedMarketOrders.add(order.market_hash_name)
      activeMarketOrders.set(order.market_hash_name, order)
    })
    if (response.count !== 100) break
    await sleep(5_000)
  }

  await sleep(5_000)

  do {
    const response = await getCSFloatListings({
      sort_by: 'most_recent',
      min_price: 1099,
      max_price: 5000,
      max_float: 0.45,
    })

    for (const item of response.data) {
      const market_hash_name = item.item.market_hash_name

      if (checkedMarketOrders.has(market_hash_name)) {
        continue
      }

      const response = await getCSFloatListings({ market_hash_name })

      if (response.data.length <= 30) {
        await sleep(60_000)
        checkedMarketOrders.add(market_hash_name)

        continue
      }

      const orders = await getBuyOrders({ id: response.data[0].id })

      if (orders[0].market_hash_name !== market_hash_name) {
        await sleep(60_000)
        checkedMarketOrders.add(market_hash_name)

        continue
      }

      const lowestItemPrice = getCSFloatItemPrice(response)
      const lowestOrderPrice = Number((orders[0].price / 100).toFixed(2))

      const estimatedProfit = Number((((lowestItemPrice - lowestOrderPrice) / lowestOrderPrice) * 100).toFixed(2))

      const max_price = Math.round((lowestOrderPrice + 0.01) * 100)

      console.log(market_hash_name, estimatedProfit, max_price)

      if (estimatedProfit >= 10) {
        await postBuyOrder({ market_hash_name, max_price })

        console.log(market_hash_name, max_price, estimatedProfit)

        await sendMessage(
          `[CSFLOAT ORDER] <a href="https://csfloat.com/item/${response.data[0].id}">${market_hash_name}</a> Estimated profit: ${estimatedProfit}%`
        )
      } else {
        console.log(market_hash_name, estimatedProfit)
      }

      checkedMarketOrders.add(market_hash_name)

      await sleep(60_000)
    }

    // eslint-disable-next-line no-constant-condition
  } while (true)
}

csFloatBuyOrders()
