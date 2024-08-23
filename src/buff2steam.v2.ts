import { Context } from 'telegraf'
import { JOBS } from '.'
import { getGoodsInfo, getGoodsSellOrder, getMarketGoods, getMarketGoodsBillOrder } from './api/buff'
import { exteriorGroups, weaponGroups } from './config'
import { MarketPriceOverview } from './types'
import { isLessThanThreshold, median, sleep } from './utils'
import { format, differenceInDays } from 'date-fns'
import { getMarketPriceOverview } from './api/steam'

export const GOODS_CACHE: Record<number, { price: number }> = {}
export const MARKET_CACHE: Record<number, MarketPriceOverview> = {}

export const buff2steam = (ctx: Context) => async () => {
  let currentPage = 1
  const pagesToLoad = 5
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
          // Get all the most recent sales from the 'Sale History' tab.
          const history = await getMarketGoodsBillOrder({ goods_id })

          // Exclude global supply and items sold more than 7 days ago.
          const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
            return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
          })

          if (salesLastWeek.length >= 5) {
            const median_price = median(salesLastWeek.map(({ price }) => Number(price)))
            const estimated_profit = ((median_price * 0.975) / current_price - 1) * 100

            if (estimated_profit > 0) {
              const sellOrders = await getGoodsSellOrder({ goods_id, max_price: sell_min_price })
              const marketOverview = await getMarketPriceOverview({ market_hash_name })
              const goodsInfo = await getGoodsInfo({ goods_id })

              const [lowestPricedItem] = sellOrders.data.items

              await ctx.telegram.sendMessage(
                ctx.message!.chat.id,
                `${market_hash_name}\n\n` +
                  `Buff price: ${current_price}$\n` +
                  `Steam price: ${steam_price}$\n` +
                  `Buff163 price: ${goodsInfo?.data?.goods_info?.goods_ref_price}$\n` +
                  `Float: ${lowestPricedItem?.asset_info?.paintwear ?? 'unknown'}\n` +
                  `Steam volume: ${marketOverview?.volume ?? 'unknown'}\n` +
                  `Estimated profit(%) ${estimated_profit.toFixed(2)}%\n` +
                  `Buff market link: https://buff.market/market/goods/${goods_id}` +
                  `Stickers: ${lowestPricedItem.asset_info.info.stickers.length}`
              )
            } else {
              console.log(`${now}: ${market_hash_name} estimated profit ${estimated_profit.toFixed(2)}%`)
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
