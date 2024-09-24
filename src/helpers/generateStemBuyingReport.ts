import 'dotenv/config'

import { getMarketGoods, getMarketGoodsBillOrder } from '../api/buff'
import { GOODS_SALES_THRESHOLD } from '../config'
import { median, sleep } from '../utils'
import { differenceInDays } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { getMaxPricesForXDays } from './getMaxPricesForXDays'

export const generateStemBuyingReport = async () => {
  let currentPage = 1
  const pagesToLoad = 1
  let hasNextPage = true

  do {
    const page_num = currentPage
    const marketGoods = await getMarketGoods({
      page_num,
      sort_by: 'sell_num.desc',
      max_price: 100,
      min_price: 50,
    })

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

      if (prices.length === 0) {
        continue
      }

      const min_steam_price = prices.sort()[1]
      const estimated_profit = (min_steam_price / median_buff_price - 1) * 100

      if (estimated_profit < 15) {
        const message: string[] = []

        message.push(
          `<a href="https://buff.market/market/goods/${item.id}">${item.market_hash_name}</a> (<a href="https://steamcommunity.com/market/listings/730/${item.market_hash_name}">steam</a>): `
        )

        message.push(`<strong>Steam price</strong> - ${min_steam_price}$, `)
        message.push(`<strong>Buff price</strong> - ${median_buff_price}$, `)
        message.push(`<strong>ROI</strong> - ${estimated_profit.toFixed(2) + '%'}, `)
        message.push(`<strong>Sales last week</strong> - ${sales.length}.`)

        await sendMessage(message.join(''))
      }

      await sleep(5_000)
    }

    if (hasNextPage) {
      await sleep(4_000)
    }

    currentPage += 1
  } while (hasNextPage)
}
