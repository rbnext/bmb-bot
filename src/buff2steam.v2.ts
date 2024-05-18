import { Context } from 'telegraf'
import { JOBS } from '.'
import { getMarketPriceHistory, getTopBookmarked } from './api/buff'
import { weaponGroups } from './config'
import { MarketPriceOverview } from './types'
import { median, sleep } from './utils'

export const GOODS_CACHE: Record<number, { price: number }> = {}
export const MARKET_CACHE: Record<number, MarketPriceOverview> = {}

export const buff2steam = (ctx: Context) => async () => {
  let currentPage = 1
  let pagesToLoad = 5
  let hasNextPage = true

  try {
    do {
      const page_num = currentPage
      const category_group = weaponGroups.join(',')
      const marketGoods = await getTopBookmarked({ category_group, page_num })

      if (marketGoods?.code === 'Internal Server Timeout') {
        await ctx.telegram.sendMessage(ctx.message!.chat.id, `Warning ${marketGoods.code}`)

        break
      }

      if (hasNextPage) {
        hasNextPage = currentPage < pagesToLoad
      }

      for (const item of marketGoods.data.items) {
        const goods_id = item.goods_id
        const steam_price = marketGoods.data.goods_infos[item.goods_id].steam_price
        const market_hash_name = marketGoods.data.goods_infos[item.goods_id].market_hash_name

        const current_price = Number(item.price)

        if (goods_id in GOODS_CACHE && GOODS_CACHE[goods_id].price === current_price) {
          continue
        }

        if (goods_id in GOODS_CACHE && GOODS_CACHE[goods_id].price !== current_price) {
          const history = await getMarketPriceHistory({ goods_id })

          console.log(market_hash_name, current_price)

          if (history.data.price_history.length >= 10) {
            const median_price = median(history.data.price_history.map(([_, price]) => price))
            const estimated_profit = (median_price / current_price - 1) * 100

            if (estimated_profit > 10) {
              await ctx.telegram.sendMessage(
                ctx.message!.chat.id,
                `${market_hash_name}\n\n` +
                  `Buff market price: ${current_price}$\n` +
                  `Steam market price: ${steam_price}$\n` +
                  `Estimated profit(%) ${estimated_profit.toFixed(2)}%\n` +
                  `Buff market link: https://buff.market/market/goods/${goods_id}`
              )
            } else {
              console.log(market_hash_name, 'estimated_profit value less then 10')
            }
          } else {
            console.log(market_hash_name, 'price_history data less then 10 items')
          }

          GOODS_CACHE[goods_id].price = current_price

          continue
        }

        GOODS_CACHE[goods_id] = { price: current_price }
      }

      if (hasNextPage) {
        await sleep(7_000)
      }

      currentPage += 1
    } while (hasNextPage)
  } catch (error) {
    console.log(error)

    JOBS[ctx.message!.chat.id].cancel()
  }
}
