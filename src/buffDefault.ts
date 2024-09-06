import 'dotenv/config'

import { differenceInDays, format } from 'date-fns'
import { getGoodsInfo, getMarketGoods, getMarketGoodsBillOrder } from './api/buff'
import { median, sleep } from './utils'
import { sendMessage } from './api/telegram'

let lastMarketHashName: string | null = null

const buffDefault = async () => {
  const now = format(new Date(), 'dd MMM yyyy, HH:mm')

  try {
    const marketGoods = await getMarketGoods({ quality: 'normal,strange,tournament', min_price: 1, max_price: 100 })

    const items = marketGoods.data.items.slice(0, 4)

    if (!lastMarketHashName) {
      lastMarketHashName = items[0].market_hash_name
    }

    if (lastMarketHashName) {
      for (const item of items) {
        if (item.market_hash_name === lastMarketHashName) {
          break
        }

        const goods_id = item.id
        const current_price = +item.sell_min_price

        const history = await getMarketGoodsBillOrder({ goods_id })

        const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
          return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
        })

        if (salesLastWeek.length >= 5) {
          const sales = salesLastWeek.map(({ price }) => Number(price))
          const median_price = median(sales.filter((price) => current_price * 2 > price))
          const estimated_profit = ((median_price * 0.975) / current_price - 1) * 100

          console.log(`${now}: ${item.market_hash_name} estimated profit ${estimated_profit.toFixed(2)}%`)

          if (estimated_profit >= (current_price >= 5 ? 10 : 20)) {
            const goodsInfo = await getGoodsInfo({ goods_id })

            const goods_ref_price = Number(goodsInfo.data.goods_info.goods_ref_price)

            if (current_price >= goods_ref_price) continue

            await sendMessage(
              `🤖 <b>MAIN PAGE BOT</b>\n\n` +
                `${item.market_hash_name}\n` +
                `<b>Buff price</b>: ${current_price}$\n` +
                `<b>Estimated profit</b>: ${estimated_profit.toFixed(2)}% if sold for ${median_price.toFixed(2)}$\n` +
                `<a href="https://buff.market/market/goods/${goods_id}">Buff market link</a>
              `
            )
          }
        }

        await sleep(1_000)
      }

      lastMarketHashName = items[0].market_hash_name
    }
  } catch (error) {
    console.log('Something went wrong', error)

    await sendMessage('Buff default bot is stopped working.')

    return
  }

  await sleep(10_000)

  buffDefault()
}

buffDefault()
