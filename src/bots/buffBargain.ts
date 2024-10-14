import 'dotenv/config'

import { getGoodsSellOrder, getMarketGoods, getShopBillOrder } from '../api/buff'
import { isLessThanThreshold, median, sleep } from '../utils'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'

export const GOODS_CACHE: Record<number, { price: number }> = {}

const buffBargain = async () => {
  const pages = Array.from({ length: 10 }, (_, i) => i + 1)

  try {
    for (const page_num of pages) {
      const marketGoods = await getMarketGoods({
        page_num,
        sort_by: 'sell_num.desc',
        category_group: 'knife,hands,rifle,pistol,smg,shotgun,machinegun',
        min_price: 20,
        max_price: 90,
      })

      for (const item of marketGoods.data.items) {
        const now = format(new Date(), 'HH:mm:ss')
        const current_price = Number(item.sell_min_price)

        if (item.id in GOODS_CACHE && isLessThanThreshold(GOODS_CACHE[item.id].price, current_price, 0.1)) {
          GOODS_CACHE[item.id].price = current_price

          continue
        }

        if (item.id in GOODS_CACHE && GOODS_CACHE[item.id].price > current_price) {
          const message: string[] = []

          const orders = await getGoodsSellOrder({ goods_id: item.id, exclude_current_user: 1 })
          const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

          if (!lowestPricedItem) continue
          if (!lowestPricedItem.allow_bargain) continue

          const userSellingHistory = await getShopBillOrder({ user_id: lowestPricedItem.user_id })

          if (userSellingHistory.code !== 'OK') continue

          const history = userSellingHistory.data.items.filter((item) => item.has_bargain)
          const average_discount = history.map((item) => (Number(item.original_price) / Number(item.price) - 1) * 100)

          console.log(`${now}: ${item.market_hash_name}`, average_discount, lowestPricedItem.user_id)

          if (median(average_discount) >= 5) {
            message.push(`<a href="https://buff.market/market/goods/${item.id}">${item.market_hash_name}</a>\n\n`)

            message.push(`<b>Price</b>: $${lowestPricedItem.price}\n`)
            message.push(
              `<b>User</b>: <a href="https://buff.market/user_store/${lowestPricedItem.user_id}/selling">${lowestPricedItem.user_id}</a>\n`
            )

            message.push(
              history
                .map((item) => `<b>Original price => price</b>: $${item.original_price} => $${item.price}`)
                .join('\n')
            )

            await sendMessage(message.join(''))
          }
        }

        GOODS_CACHE[item.id] = { price: current_price }
      }

      await sleep(3_000)
    }
  } catch (error) {
    console.log('Something went wrong', error)

    await sendMessage(error?.message ?? 'Something went wrong.')

    return
  }

  buffBargain()
}

buffBargain()
