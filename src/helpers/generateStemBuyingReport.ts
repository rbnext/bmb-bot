import 'dotenv/config'

import { getMarketGoods, getMarketGoodsBillOrder } from '../api/buff'
import { GOODS_SALES_THRESHOLD, weaponGroups } from '../config'
import { median, sleep } from '../utils'
import { differenceInDays } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { getMaxPricesForXDays } from './getMaxPricesForXDays'

export const generateStemBuyingReport = async () => {
  let currentPage = 3
  const pagesToLoad = 1
  let hasNextPage = true

  const messages: string[] = []

  do {
    const page_num = currentPage
    const category_group = weaponGroups.join(',')
    const marketGoods = await getMarketGoods({
      category_group,
      page_num,
      sort_by: 'sell_num.desc',
      max_price: 5,
      min_price: 2,
    })

    console.log(marketGoods.data.items.length)

    if (hasNextPage) {
      hasNextPage = currentPage < pagesToLoad
    }

    for (const item of marketGoods.data.items) {
      const goods_id = item.id
      const current_price = Number(item.sell_min_price)

      const history = await getMarketGoodsBillOrder({ goods_id })

      const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
        return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
      })

      if (salesLastWeek.length < GOODS_SALES_THRESHOLD) {
        await sleep(1_000)

        continue
      }

      const sales = salesLastWeek.map(({ price }) => Number(price))
      const median_buff_price = median(sales.filter((price) => current_price * 2 > price))

      const prices = await getMaxPricesForXDays(item.market_hash_name, 'min')

      const min_steam_price = prices.length !== 0 ? Math.max(...prices) : 0
      const estimated_profit = ((min_steam_price - median_buff_price) / median_buff_price) * 100

      if (estimated_profit < 15) {
        console.log(
          item.market_hash_name,
          JSON.stringify({
            steam: min_steam_price,
            buff: median_buff_price,
            diff: estimated_profit.toFixed(2) + '%',
            sales: sales.length,
          })
        )
      }

      await sleep(3_000)
    }

    if (hasNextPage) {
      await sleep(4_000)
    }

    currentPage += 1
  } while (hasNextPage)

  if (messages.length !== 0) {
    await sendMessage(messages.join())
  }
}
