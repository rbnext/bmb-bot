import { getGoodsSellOrder } from '../api/buff'
import { sendMessage } from '../api/telegram'
import { createVercelPurchase } from '../api/vercel'
import { STEAM_CHECK_THRESHOLD, STEAM_PURCHASE_THRESHOLD } from '../config'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage, sleep } from '../utils'
import { getMaxPricesForXDays } from './getMaxPricesForXDays'

export const executeBuffToSteamTrade = async (
  item: MarketGoodsItem,
  options: {
    source: Source
  }
) => {
  const goods_id = item.id
  const current_price = Number(item.sell_min_price)
  const steam_price = Number(item.goods_info.steam_price)

  const diffWithSteam = ((steam_price - current_price) / current_price) * 100

  if (STEAM_CHECK_THRESHOLD > diffWithSteam) {
    return
  }

  const prices = await getMaxPricesForXDays(item.market_hash_name)

  const min_steam_price = prices.length !== 0 ? Math.min(...prices) : 0
  const estimated_profit = ((min_steam_price - current_price) / current_price) * 100

  if (estimated_profit >= STEAM_PURCHASE_THRESHOLD) {
    const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })

    const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

    if (!lowestPricedItem) {
      await sendMessage(`[${options.source}] Someone already bought the ${item.market_hash_name} item.`)

      return
    }

    const response = await createVercelPurchase({ price: current_price, sell_order_id: lowestPricedItem.id })

    if (response.code !== 'OK') {
      await sendMessage(
        `[${options.source}] Failed to purchase the item ${item.market_hash_name}. Reason: ${response.code}`
      )

      return
    }

    await sendMessage(
      generateMessage({
        id: goods_id,
        price: current_price,
        type: MessageType.Purchased,
        name: item.market_hash_name,
        createdAt: lowestPricedItem.created_at,
        updatedAt: lowestPricedItem.updated_at,
        estimatedProfit: estimated_profit,
        medianPrice: min_steam_price,
        float: lowestPricedItem.asset_info.paintwear,
        source: options.source,
      })
    )
  }
}
