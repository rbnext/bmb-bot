import 'dotenv/config'

import { getCSFloatItemPrice, sleep } from '../utils'
import { getBuyOrders, getCSFloatListings, getPlacedOrders, postBuyOrder, removeBuyOrder } from '../api/csfloat'
import { CSFloatPlacedOrder } from '../types'

const activeMarketOrders = new Map<string, CSFloatPlacedOrder>()

const csFloatBuyOrders = async () => {
  const response = await getPlacedOrders({ page: 0, limit: 30 })
  console.log('Total: ', response.count)
  response.orders.forEach((order) => activeMarketOrders.set(order.market_hash_name, order))

  // for (const item of response.orders) {
  //   if (item.market_hash_name === 'Glock-18 | Vogue (Field-Tested)') {
  //     await removeBuyOrder({ id: item.id })
  //   }
  // }

  await sleep(5_000)

  for (const [marketHashName, activeOrder] of activeMarketOrders) {
    const response = await getCSFloatListings({ market_hash_name: marketHashName })
    const orders = await getBuyOrders({ id: response.data[0].id })

    const lowestItemPrice = getCSFloatItemPrice(response)

    const lowestOrderPrice = Number((orders[0].price / 100).toFixed(2))
    const secondOrderPrice = Number((orders[1].price / 100).toFixed(2))

    const currentOrderPrice = Number((activeOrder.price / 100).toFixed(2))

    console.log(
      marketHashName,
      orders.findIndex((i) => i.price === activeOrder.price)
    )

    if (lowestOrderPrice > currentOrderPrice && orders[0].market_hash_name === marketHashName) {
      const estimatedProfit = Number((((lowestItemPrice - lowestOrderPrice) / lowestOrderPrice) * 100).toFixed(2))

      if (estimatedProfit >= 8) {
        const maxPrice = Math.round((lowestOrderPrice + 0.01) * 100)

        await removeBuyOrder({ id: activeOrder.id })
        await postBuyOrder({ market_hash_name: marketHashName, max_price: maxPrice })

        console.log(marketHashName, currentOrderPrice, '->', maxPrice / 100)
      } else if (estimatedProfit <= 5) {
        await removeBuyOrder({ id: activeOrder.id })
        console.log(marketHashName, 'removed')
      }
    }

    if (
      lowestOrderPrice === currentOrderPrice &&
      Number((lowestOrderPrice - secondOrderPrice).toFixed(2)) > 0.01 &&
      orders[0].market_hash_name === marketHashName
    ) {
      const maxPrice = Math.round((secondOrderPrice + 0.01) * 100)

      await removeBuyOrder({ id: activeOrder.id })
      await postBuyOrder({ market_hash_name: marketHashName, max_price: maxPrice })

      console.log(marketHashName, currentOrderPrice, '->', maxPrice / 100)
    }

    await sleep(7_000)
  }
}

csFloatBuyOrders()
