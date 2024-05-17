import { Context } from 'telegraf'
import { JOBS } from '.'
import { getMarketGoods, getMarketGoodsBillOrder } from './api/buff'
import { getMarketPriceOverview } from './api/steam'
import { weaponGroups } from './config'
import { purchaseGoodsById } from './core'
import { MarketPriceOverview } from './types'
import { calculateROI, canMakePurchase, sleep } from './utils'

export const MARKET_CACHE: Record<string, MarketPriceOverview> = {}

export const buff2steam = (ctx: Context) => async () => {
  let currentPage = 1
  let pagesToLoad = 20
  let hasNextPage = true

  try {
    do {
      const page_num = currentPage
      const category_group = weaponGroups.join(',')
      const marketGoods = await getMarketGoods({ category_group, page_num })

      if (marketGoods?.code === 'Internal Server Timeout') {
        await ctx.telegram.sendMessage(ctx.message!.chat.id, `Warning ${marketGoods.code}`)

        break
      }

      if (hasNextPage) {
        hasNextPage = currentPage < pagesToLoad
      }

      for (const item of marketGoods.data.items) {
        const market_hash_name = item.market_hash_name
        const sellMaxPrice = +item.goods_info.steam_price
        const sellMinPrice = +item.sell_min_price

        if (calculateROI(sellMaxPrice, sellMinPrice) < 45) {
          continue
        }

        const cache = MARKET_CACHE[market_hash_name]
        const marketOverview = cache ? cache : await getMarketPriceOverview({ market_hash_name })
        MARKET_CACHE[market_hash_name] = { ...marketOverview }

        if (!canMakePurchase({ marketOverview, sellMinPrice, minVolume: 100 })) {
          console.log(market_hash_name, `steam volume: ${MARKET_CACHE[market_hash_name].volume}\n`)
          continue
        }

        const marketGoodsBillOrders = await getMarketGoodsBillOrder({ goods_id: item.id })
        const has_lower_than_current_price = marketGoodsBillOrders.data.items.some((item) => sellMinPrice > +item.price)

        if (marketGoodsBillOrders.data.items.length !== 0 && !has_lower_than_current_price) {
          await purchaseGoodsById(item, ctx)
        } else {
          console.log(market_hash_name, `has lower than current price: ${has_lower_than_current_price}`)
        }
      }

      if (hasNextPage) {
        await sleep(10_000)
      }

      currentPage += 1
    } while (hasNextPage)
  } catch (error) {
    console.log(error)

    JOBS[ctx.message!.chat.id].cancel()
  }
}
