import 'dotenv/config'

import { median, sleep } from '../utils'
import { getCSFloatListings, getCSFloatSimpleOrders, getPlacedOrders, postBuyOrder } from '../api/csfloat'
import { sendMessage } from '../api/telegram'
import { differenceInDays, format } from 'date-fns'
import path from 'path'
import { readFileSync } from 'fs'
import { getGoodsInfo, getMarketGoodsBillOrder } from '../api/buff'

const activeMarketOrders = new Set<string>()

const csFloatBuyOrders = async () => {
  const pages = Array.from({ length: 5 }, (_, i) => i)

  for (const page of pages) {
    const response = await getPlacedOrders({ page, limit: 100 })
    response.orders.forEach((order) => activeMarketOrders.add(order.market_hash_name))
    if (response.count !== 100) break
    await sleep(5_000)
  }

  const pathname = path.join(__dirname, '../../buff.json')
  const data: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

  await sleep(5_000)

  for (const market_hash_name of Object.keys(data)) {
    if (activeMarketOrders.has(market_hash_name)) continue

    const orders = await getCSFloatSimpleOrders({ market_hash_name })

    await sleep(5_000)

    const lowestOrder = orders.data[0]

    if (!lowestOrder) continue
    if (!lowestOrder?.market_hash_name) continue
    if (lowestOrder.market_hash_name !== market_hash_name) continue

    const lowestCSFloatOrderPrice = Number((lowestOrder.price / 100).toFixed(2))

    const goodsInfo = await getGoodsInfo({ goods_id: data[market_hash_name] })
    const buffReferencePrice = Number(goodsInfo.data.goods_info.goods_ref_price)

    await sleep(5_000)

    const history = await getMarketGoodsBillOrder({ goods_id: data[market_hash_name] })
    const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
      return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
    })
    const sales = salesLastWeek.map(({ price }) => Number(price))
    const buffMedianPrice = median(sales.filter((price) => lowestCSFloatOrderPrice * 2 > price))

    const bargainPrice = Number((Math.min(buffMedianPrice, buffReferencePrice) * 0.94).toFixed(1))

    console.log(market_hash_name, lowestCSFloatOrderPrice, bargainPrice)

    if (bargainPrice > lowestCSFloatOrderPrice) {
      const max_price = Math.round((lowestCSFloatOrderPrice + 0.01) * 100)
      console.log(market_hash_name, max_price)
      await postBuyOrder({ market_hash_name, max_price })

      await sendMessage(
        `The order for ${market_hash_name} has been created with a price of ${(lowestCSFloatOrderPrice + 0.01).toFixed(2)}.`
      )
    }

    await sleep(10_000)
  }
}

csFloatBuyOrders()
