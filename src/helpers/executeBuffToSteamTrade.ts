import { getGoodsSellOrder, postGoodsBuy } from '../api/buff'
import { sendMessage } from '../api/telegram'
import { STEAM_CHECK_THRESHOLD, STEAM_PURCHASE_THRESHOLD } from '../config'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage, getCSFloatItemPrice, getItemExterior } from '../utils'
import { getMaxPricesForXDays } from './getMaxPricesForXDays'
import { getCSFloatListings } from '../api/csfloat'

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

  const { isFactoryNew, isFieldTested, isMinimalWear } = getItemExterior(item.market_hash_name)

  const prices = await getMaxPricesForXDays(item.market_hash_name)
  const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })
  const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

  if (!lowestPricedItem) return

  const keychain = lowestPricedItem.asset_info.info?.keychains?.[0]
  const k_total = keychain ? Number(keychain.sell_reference_price) - 0.33 : 0

  if (k_total !== 0) {
    console.log(keychain.name, keychain.sell_reference_price)
  }

  const min_steam_price = prices.length !== 0 ? Math.min(...prices) : 0
  const estimated_profit = ((min_steam_price - (current_price - k_total)) / (current_price - k_total)) * 100

  const payload = {
    id: goods_id,
    keychain: keychain,
    price: current_price,
    name: item.market_hash_name,
    type: MessageType.Purchased,
    createdAt: lowestPricedItem.created_at,
    updatedAt: lowestPricedItem.updated_at,
    float: lowestPricedItem.asset_info.paintwear,
    source: options.source,
  }

  if (
    (current_price < 2 && estimated_profit >= STEAM_PURCHASE_THRESHOLD + 30) ||
    (current_price >= 2 && estimated_profit >= STEAM_PURCHASE_THRESHOLD)
  ) {
    const response = await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })

    if (response.code !== 'OK') {
      sendMessage(`[${options.source}] Failed to purchase the item ${item.market_hash_name}. Reason: ${response.code}`)

      return
    }

    sendMessage(generateMessage({ ...payload, estimatedProfit: estimated_profit, medianPrice: min_steam_price }))
  } else if (isFactoryNew || isMinimalWear || isFieldTested) {
    const response = await getCSFloatListings({ market_hash_name: item.market_hash_name })

    const cs_float_price = getCSFloatItemPrice(response)
    const estimated_profit = ((cs_float_price - (current_price - k_total)) / (current_price - k_total)) * 100

    console.log(item.market_hash_name, estimated_profit.toFixed(2))

    if ((current_price < 2 && estimated_profit >= 40) || (current_price >= 2 && estimated_profit >= 20)) {
      const response = await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })

      if (response.code !== 'OK') {
        sendMessage(
          `[${options.source}] Failed to purchase the item ${item.market_hash_name}. Reason: ${response.code}`
        )

        return
      }

      sendMessage(
        generateMessage({
          ...payload,
          csFloatPrice: cs_float_price,
          estimatedProfit: estimated_profit,
          medianPrice: cs_float_price,
          source: Source.BUFF_CSFLOAT,
        })
      )
    }
  }
}
