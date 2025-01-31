import 'dotenv/config'

import { median, sleep } from '../utils'
import { getCSFloatSimpleOrders, getPlacedOrders, postBuyOrder, removeBuyOrder } from '../api/csfloat'
import { differenceInDays } from 'date-fns'
import path from 'path'
import { readFileSync } from 'fs'
import { getGoodsInfo, getMarketGoodsBillOrder } from '../api/buff'

const pathname = path.join(__dirname, '../../buff.json')
const data: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

const csFloatBuyOrdersOverview = async () => {
  const response = await getPlacedOrders({ page: 1, limit: 100 })

  await sleep(5_000)

  for (const order of response.orders) {
    const orders = await getCSFloatSimpleOrders({ market_hash_name: order.market_hash_name })
    const orderIndex = orders.data.findIndex((o) => o.price === order.price)

    const lowestOrder = orders.data[0]

    if (!lowestOrder) continue
    if (!data[order.market_hash_name]) continue
    if (!lowestOrder?.market_hash_name) continue
    if (orderIndex === -1) continue

    const lowestCSFloatOrderPrice = Number((lowestOrder.price / 100).toFixed(2))
    const currentCSFloatOrderPrice = Number((orders.data[orderIndex].price / 100).toFixed(2))

    if (orderIndex === 0) {
      const prevCSFloatOrderPrice = Number((orders.data[orderIndex + 1].price / 100).toFixed(2))

      if (
        currentCSFloatOrderPrice === prevCSFloatOrderPrice ||
        Number((currentCSFloatOrderPrice - prevCSFloatOrderPrice).toFixed(2)) > 0.01
      ) {
        const max_price = Math.round((prevCSFloatOrderPrice + 0.01) * 100)

        await removeBuyOrder({ id: order.id }).then(() => sleep(5_000))
        await postBuyOrder({ market_hash_name: order.market_hash_name, max_price })

        console.log(order.market_hash_name, currentCSFloatOrderPrice, '->', Number((max_price / 100).toFixed(2)))
      }
    } else {
      const goodsInfo = await getGoodsInfo({ goods_id: data[order.market_hash_name] })
      const buffReferencePrice = Number(goodsInfo.data.goods_info.goods_ref_price)

      const history = await getMarketGoodsBillOrder({ goods_id: data[order.market_hash_name] })
      const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
        return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
      })
      const sales = salesLastWeek.map(({ price }) => Number(price))
      const buffMedianPrice = median(sales.filter((price) => lowestCSFloatOrderPrice * 2 > price))

      const bargainPrice = Number((Math.min(buffMedianPrice, buffReferencePrice) * 0.93).toFixed(1))
      const max_price = Math.round((lowestCSFloatOrderPrice + 0.01) * 100)

      if (bargainPrice > lowestCSFloatOrderPrice) {
        await removeBuyOrder({ id: order.id }).then(() => sleep(5_000))
        await postBuyOrder({ market_hash_name: order.market_hash_name, max_price })

        console.log(order.market_hash_name, currentCSFloatOrderPrice, '->', Number((max_price / 100).toFixed(2)))
      } else {
        console.log(order.market_hash_name, 'Bargain/Lowest price:', bargainPrice, Number((max_price / 100).toFixed(2)))
      }
    }

    await sleep(5_000)
  }
}

csFloatBuyOrdersOverview()
