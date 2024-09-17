import { getBriefAsset, getGoodsSellOrder, postGoodsBuy } from '../api/buff'
import { sendMessage } from '../api/telegram'
import { STEAM_CHECK_THRESHOLD, STEAM_PURCHASE_THRESHOLD } from '../config'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage } from '../utils'
import { getMaxPricesForXDays } from './getMaxPricesForXDays'

export const executeBuffToSteamTrade = async (item: MarketGoodsItem) => {
  const goods_id = item.id
  const current_price = +item.sell_min_price

  const sales = await getMaxPricesForXDays(item.market_hash_name)

  if (sales.length === 0) {
    throw new Error(`Oops! Item ${item.market_hash_name} is not liquid.`)
  }

  const min_steam_price = Math.min(...sales)
  const estimated_profit = ((min_steam_price - current_price) / current_price) * 100

  if (STEAM_CHECK_THRESHOLD > estimated_profit) {
    throw new Error(`Oops! Item ${item.market_hash_name} does not meet the profitability threshold.`)
  }

  const payload = {
    id: goods_id,
    price: current_price,
    estimatedProfit: estimated_profit,
    medianPrice: min_steam_price,
    name: item.market_hash_name,
    source: Source.BUFF_STEAM,
  }

  if (estimated_profit >= STEAM_PURCHASE_THRESHOLD) {
    const {
      data: { cash_amount },
    } = await getBriefAsset()

    const {
      data: {
        items: [lowestPricedItem],
      },
    } = await getGoodsSellOrder({ goods_id, max_price: item.sell_min_price })

    if (!lowestPricedItem) {
      throw new Error(`Oops! Someone already bought the ${item.market_hash_name} item.`)
    }

    if (current_price > +cash_amount) {
      throw new Error(`Oops! You don't have enough funds to buy ${item.market_hash_name} item.`)
    }

    const response = await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })

    if (response.code !== 'OK') {
      throw new Error(`Failed to purchase the item ${item.market_hash_name}. Reason: ${response.code}`)
    }

    await sendMessage(generateMessage({ type: MessageType.Purchased, ...payload }))
  } else {
    await sendMessage(generateMessage({ type: MessageType.Review, ...payload }))
  }
}
