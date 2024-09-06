import 'dotenv/config'

import { differenceInDays, format } from 'date-fns'
import { getMarketGoods, getMarketGoodsBillOrder } from './api/buff'
import { median, sleep } from './utils'
import { sendMessage } from './api/telegram'
import { weaponGroups } from './config'

let lastMarketHashName: string | null = null

const buffDefault = async () => {
  // await sendMessage(`🤖 I am working!`)
  try {
    const category_group = weaponGroups.join(',')
    const marketGoods = await getMarketGoods({ category_group, min_price: 5, max_price: 100 })
    const now = format(new Date(), 'dd MMM yyyy, HH:mm')

    const items = marketGoods.data.items.slice(0, 4)

    if (!lastMarketHashName) {
      lastMarketHashName = marketGoods.data.items[0].market_hash_name
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

          // if (estimated_profit > 4) {
          await sendMessage(
            `🤖 **MAIN PAGE BOT**\n\n` +
              `${item.market_hash_name}.\n` +
              `**Buff price**: ${current_price}$\n` +
              `**Estimated profit**: ${estimated_profit.toFixed(2)}% if sold for ${median_price}$\n` +
              `[Buff market link](https://buff.market/market/goods/${goods_id})`
          )
          // }
        }

        await sleep(1_000)
      }

      lastMarketHashName = items[0].market_hash_name
    }
  } catch (error) {
    console.log(error)

    return
  }

  await sleep(10_000)

  buffDefault()
}

buffDefault()
