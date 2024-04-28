import { getBriefAsset, getGoodsSellOrder, getMarketGoods, postGoodsBuy } from './api/buff'
import { getMarketPriceOverview } from './api/steam'
import { MarketPriceOverview } from './types'
import { calculateROI, canMakePurchase, sleep } from './utils'

const MARKET_CACHE: Record<string, MarketPriceOverview> = {}

const MESSAGE_LOGS: string[] = []

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
      await logger({ message: marketGoods.code })

      break
    }

    if (hasNextPage) {
      hasNextPage = currentPage < pagesToLoad
    }

    for (const {
      id,
      sell_min_price,
      market_hash_name,
      sell_reference_price,
      goods_info: { steam_price },
    } of marketGoods.data.items) {
      const sellMaxPrice = +steam_price
      const sellMinPrice = +sell_min_price

      const initialRoi = calculateROI(sellMaxPrice, sellMinPrice)

      if (initialRoi < 50) continue

      const cache = MARKET_CACHE[market_hash_name]
      const marketOverview = cache ? cache : await getMarketPriceOverview({ market_hash_name })
      MARKET_CACHE[market_hash_name] = { ...marketOverview }

      if (!canMakePurchase({ marketOverview, sellMinPrice, minVolume: 50 })) {
        const message = `Product ${market_hash_name} with initial ROI ${initialRoi.toFixed(2)}% and price ${sellMinPrice}$ has been skipped due to: ${JSON.stringify(marketOverview)}\n`

        if (!MESSAGE_LOGS.includes(message)) {
          await logger({ message })

          MESSAGE_LOGS.push(message)
        }

        break
      }

      const {
        data: { total_amount },
      } = await getBriefAsset()

      let totalAmount = Number(total_amount) ?? 0

      const sellOrders = await getGoodsSellOrder({ goods_id: id, max_price: sell_min_price, exclude_current_user: 1 })

      for (const filteredGood of sellOrders.data.items) {
        const profit = Number(sell_reference_price) - Number(filteredGood.price)

        if (Number(filteredGood.price) > totalAmount) {
          await logger({ message: `No cash to buy "${market_hash_name}" for ${filteredGood.price}$`, error: true })

          break
        }

        await sleep(2_000)
        await postGoodsBuy({ sell_order_id: filteredGood.id, price: Number(filteredGood.price) })
        await logger({ message: `Purchase "${market_hash_name}". Profit: ~${profit.toFixed(2)}$` })

        totalAmount -= Number(filteredGood.price)
      }

      await logger({ message: `Balance: ${totalAmount.toFixed(2)}$` })
    }

    if (hasNextPage) {
      await sleep(11_555)
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
