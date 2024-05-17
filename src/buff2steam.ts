import { getMarketGoods, getMarketGoodsBillOrder } from './api/buff'
import { getMarketPriceOverview } from './api/steam'
import { purchaseGoodsById } from './core'
import { MarketPriceOverview } from './types'
import { calculateROI, canMakePurchase, sleep } from './utils'

const MARKET_CACHE: Record<string, MarketPriceOverview> = {}

export const buff2steam = async ({
  pagesToLoad,
  params,
  logger,
}: {
  pagesToLoad: number
  params: Record<string, string | number>
  logger: (data: { message: string; error?: boolean }) => void
}) => {
  let currentPage = 1
  let hasNextPage = pagesToLoad > 1

  do {
    const marketGoods = await getMarketGoods({ ...params, page_num: currentPage })

    if (marketGoods?.code === 'Internal Server Timeout') {
      await logger({ message: `Warning: ${marketGoods.code}` })

      break
    }

    if (hasNextPage) {
      hasNextPage = currentPage < pagesToLoad
    }

    for (const {
      id,
      sell_min_price,
      market_hash_name,
      goods_info: { steam_price },
    } of marketGoods.data.items) {
      const sellMaxPrice = +steam_price
      const sellMinPrice = +sell_min_price

      if (calculateROI(sellMaxPrice, sellMinPrice) < 45) {
        continue
      }

      const cache = MARKET_CACHE[market_hash_name]
      const marketOverview = cache ? cache : await getMarketPriceOverview({ market_hash_name })
      MARKET_CACHE[market_hash_name] = { ...marketOverview }

      if (!canMakePurchase({ marketOverview, sellMinPrice, minVolume: 100 })) {
        console.log(
          `Purchase '${market_hash_name}' has been skipped because of low market volume ${marketOverview.volume}`
        )

        continue
      }

      const marketGoodsBillOrders = await getMarketGoodsBillOrder({ goods_id: id })
      const has_lower_than_current_price = marketGoodsBillOrders.data.items.some((item) => sellMinPrice > +item.price)

      if (marketGoodsBillOrders.data.items.length !== 0 && !has_lower_than_current_price) {
        await purchaseGoodsById({ goodsId: id, sellMinPrice: sell_min_price, marketHashName: market_hash_name, logger })
      }
    }

    if (hasNextPage) {
      await sleep(10_000)
    }

    currentPage += 1
  } while (hasNextPage)
}

// buff2steam({
//   pagesToLoad: 20,
//   params: {
//     min_price: 1,
//     max_price: 4,
//     sort_by: 'sell_num.desc',
//     category_group: weaponGroups.join(','),
//   },
//   logger: ({ message, error }) => {
//     if (error) console.warn(message)
//     else console.log(message)
//   },
// })
