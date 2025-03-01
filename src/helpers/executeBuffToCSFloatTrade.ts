import { getGoodsSellOrder } from '../api/buff'
import { sendMessage } from '../api/telegram'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage } from '../utils'
import { getCSFloatListings } from '../api/csfloat'
import { STEAM_CHECK_THRESHOLD } from '../config'

export const executeBuffToCSFloatTrade = async (
  item: MarketGoodsItem,
  options: {
    source: Source
  }
) => {
  const goods_id = item.id
  const current_price = Number(item.sell_min_price)
  const steam_price = Number(item.goods_info.steam_price)

  if (STEAM_CHECK_THRESHOLD >= ((steam_price - current_price) / current_price) * 100) {
    return
  }

  const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })
  const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

  if (!lowestPricedItem) return

  const keychain = lowestPricedItem.asset_info.info?.keychains?.[0]
  const k_total = keychain ? Number(keychain.sell_reference_price) - 0.33 : 0

  const stickerTotal = (lowestPricedItem.asset_info.info?.stickers || []).reduce((acc, sticker) => {
    return sticker.wear === 0 ? acc + Number(sticker.sell_reference_price) : acc
  }, 0)

  const payload = {
    id: goods_id,
    keychain: keychain,
    price: current_price,
    name: item.market_hash_name,
    type: MessageType.Review,
    float: lowestPricedItem.asset_info.paintwear,
    stickerTotal: stickerTotal,
    source: options.source,
  }

  if (payload.float) {
    const response = await getCSFloatListings({ market_hash_name: item.market_hash_name })

    const cs_float_price = response.data[0].price
    const estimated_profit = ((cs_float_price - (current_price - k_total)) / (current_price - k_total)) * 100

    console.log(item.market_hash_name, estimated_profit + '%')

    if (estimated_profit >= 30) {
      sendMessage(
        generateMessage({
          ...payload,
          csFloatPrice: cs_float_price,
          estimatedProfit: estimated_profit,
          medianPrice: cs_float_price,
        })
      )
    }
  }
}
