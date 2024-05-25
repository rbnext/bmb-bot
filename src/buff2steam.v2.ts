import { Context } from 'telegraf'
import { JOBS } from '.'
import { getGoodsSellOrder, getMarketGoods, getMarketPriceHistory } from './api/buff'
import { exteriorGroups, weaponGroups } from './config'
import { MarketPriceOverview } from './types'
import { isLessThanThreshold, median, sleep } from './utils'
import { format } from 'date-fns'
import { getMarketPriceOverview } from './api/steam'

export const GOODS_CACHE: Record<number, { price: number }> = {}
export const MARKET_CACHE: Record<number, MarketPriceOverview> = {}

export const buff2steam = (ctx: Context) => async () => {
  let currentPage = 1
  let pagesToLoad = 5
  let hasNextPage = true

  try {
    do {
      const page_num = currentPage
      const exterior = exteriorGroups.join(',')
      const category_group = weaponGroups.join(',')
      const marketGoods = await getMarketGoods({ category_group, page_num, exterior })

      if (marketGoods?.code === 'Internal Server Timeout') {
        await ctx.telegram.sendMessage(ctx.message!.chat.id, `Warning ${marketGoods.code}`)

        break
      }

      if (hasNextPage) {
        hasNextPage = currentPage < pagesToLoad
      }

      for (const item of marketGoods.data.items) {
        const goods_id = item.id
        const steam_price = item.goods_info.steam_price
        const market_hash_name = item.market_hash_name
        const sell_min_price = item.sell_min_price

        const current_price = Number(sell_min_price)

        const now = format(new Date(), 'dd MMM yyyy, HH:mm')

        if (goods_id in GOODS_CACHE && isLessThanThreshold(GOODS_CACHE[goods_id].price, current_price)) {
          GOODS_CACHE[goods_id].price = current_price

          continue
        }

        if (goods_id in GOODS_CACHE && GOODS_CACHE[goods_id].price !== current_price) {
          console.log(`${now}: ${market_hash_name} ${GOODS_CACHE[goods_id].price}$ -> ${current_price}$`)
        }

        if (goods_id in GOODS_CACHE && GOODS_CACHE[goods_id].price > current_price) {
          const history = await getMarketPriceHistory({ goods_id })

          if (history.data.price_history.length >= 5) {
            const median_price = median(history.data.price_history.map(([_, price]) => price))
            const estimated_profit = ((median_price * 0.975) / current_price - 1) * 100

            if (estimated_profit > 0) {
              const sellOrders = await getGoodsSellOrder({ goods_id, max_price: sell_min_price })
              const marketOverview = await getMarketPriceOverview({ market_hash_name })

              const [lowestPricedItem] = sellOrders.data.items

              await ctx.telegram.sendMessage(
                ctx.message!.chat.id,
                `${market_hash_name}\n\n` +
                  `Buff price: ${current_price}$\n` +
                  `Float: ${lowestPricedItem?.asset_info?.paintwear ?? 'unknown'}\n` +
                  `Steam price: ${steam_price}$\n` +
                  `Steam volume: ${marketOverview?.volume ?? 'unknown'}\n` +
                  `Estimated profit(%) ${estimated_profit.toFixed(2)}%\n` +
                  `Buff market link: https://buff.market/market/goods/${goods_id}`
              )
            } else {
              console.log(`${now}: ${market_hash_name} estimated profit: ${estimated_profit.toFixed(2)}%`)
            }
          }

          await sleep(2_000)
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
