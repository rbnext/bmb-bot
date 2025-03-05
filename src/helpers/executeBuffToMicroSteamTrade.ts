import { getGoodsSellOrder, postGoodsBuy } from '../api/buff'
import { sendMessage } from '../api/telegram'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage } from '../utils'

export const executeBuffToMicroSteamTrade = async (
  item: MarketGoodsItem,
  options: {
    source: Source
  }
) => {
  const goods_id = item.id
  const current_price = Number(item.sell_min_price)
  const steam_price = Number(item.goods_info.steam_price)

  const steamPriceAfterFee = Math.max(steam_price - 0.01 - steam_price * 0.15, steam_price - 0.01 - 0.02)
  const profitPercentage = ((steamPriceAfterFee - current_price) / current_price) * 100

  const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })
  const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

  if (!lowestPricedItem) return

  const keychain = lowestPricedItem.asset_info.info?.keychains?.[0]

  const stickerTotal = (lowestPricedItem.asset_info.info?.stickers || []).reduce((acc, sticker) => {
    return sticker.wear === 0 ? acc + Number(sticker.sell_reference_price) : acc
  }, 0)

  const payload = {
    id: goods_id,
    keychain: keychain,
    price: current_price,
    name: item.market_hash_name,
    type: MessageType.Purchased,
    medianPrice: steam_price - 0.01,
    estimatedProfit: profitPercentage,
    float: lowestPricedItem.asset_info.paintwear,
    stickerTotal: stickerTotal,
    source: options.source,
  }

  const response = await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })

  if (response.code !== 'OK') {
    sendMessage(`[${options.source}] Failed to purchase the item ${item.market_hash_name}. Reason: ${response.code}`)

    return
  }

  sendMessage(generateMessage({ ...payload }))
}
