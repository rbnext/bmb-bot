import 'dotenv/config'

import { getCSFloatItemPrice, sleep } from '../utils'
import {
  getBuyOrders,
  getCSFloatListings,
  getCSFloatSimpleOrders,
  getPlacedOrders,
  postBuyOrder,
  removeBuyOrder,
} from '../api/csfloat'
import { sendMessage } from '../api/telegram'
import { CSFloatPlacedOrder } from '../types'
import { format } from 'date-fns'
import { BuyOrderModel } from '../db/models/buy-order'
import { connectToDatabase } from '../db'

const checkedMarketOrders = new Set<string>()
// const activeMarketOrders = new Map<string, CSFloatPlacedOrder>()

const csFloatBuyOrders = async () => {
  await connectToDatabase()
  // const pages = Array.from({ length: 5 }, (_, i) => i)

  // for (const page of pages) {
  //   const response = await getPlacedOrders({ page, limit: 100 })
  //   response.orders.forEach((order) => {
  //     checkedMarketOrders.add(order.market_hash_name)
  //     activeMarketOrders.set(order.market_hash_name, order)
  //   })
  //   if (response.count !== 100) break
  //   await sleep(5_000)
  // }

  // await sleep(5_000)

  // console.log('orders placed: ', checkedMarketOrders.size)

  // const buyOrders = await BuyOrderModel.find({}).limit(100)

  // for (const order of buyOrders) {
  //   const orders = await getBuyOrders({ id: order.listingReferenceId })

  //   await BuyOrderModel.updateOne(
  //     {
  //       markerHashName: order.markerHashName,
  //     },
  //     {
  //       $set: { lowestOrderPrice: orders[0].price },
  //     },
  //     {
  //       runValidators: true,
  //     }
  //   )

  //   console.log(order.markerHashName)

  //   await sleep(5_000)
  // }

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
      const lowestItemPrice = getCSFloatItemPrice(response)

      if (response.data.length < 40 || lowestItemPrice <= 10) {
        await sleep(30_000)
        checkedMarketOrders.add(market_hash_name)

        continue
      }

      console.log(market_hash_name, response.data.length, lowestItemPrice)

      await BuyOrderModel.findOneAndUpdate(
        {
          markerHashName: market_hash_name,
        },
        {
          $set: {
            markerHashName: market_hash_name,
            listingReferenceId: response.data[0].id,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
        }
      )

      // const orders = await getBuyOrders({ id: response.data[0].id })

      // if (orders[0].market_hash_name !== market_hash_name || orders[0].price - orders[1].price >= 50) {
      //   await sleep(30_000)
      //   checkedMarketOrders.add(market_hash_name)

      //   continue
      // }

      // const lowestOrderPrice = Number((orders[0].price / 100).toFixed(2))
      // const estimatedProfit = Number((((lowestItemPrice - lowestOrderPrice) / lowestOrderPrice) * 100).toFixed(2))
      // const max_price = Math.round((lowestOrderPrice + 0.01) * 100)

      // console.log(format(new Date(), 'HH:mm:ss'), market_hash_name, `${estimatedProfit}%`)

      // if (estimatedProfit >= 10) {
      //   await postBuyOrder({ market_hash_name, max_price }).then(() => sleep(10_000))

      //   await sendMessage(
      //     `<b>[CSFLOAT ORDER]</b> <a href="https://csfloat.com/item/${response.data[0].id}">${market_hash_name}</a> Estimated profit: ${estimatedProfit}%. Order: ${(max_price / 100).toFixed(2)}`
      //   )

      //   const response = await getPlacedOrders({ limit: 100 })
      //   for (const order of response.orders) {
      //     activeMarketOrders.set(order.market_hash_name, order)
      //   }
      // }

      checkedMarketOrders.add(market_hash_name)

      await sleep(60_000)
    }

    await sleep(60_000)

    // eslint-disable-next-line no-constant-condition
  } while (true)
}

csFloatBuyOrders()
