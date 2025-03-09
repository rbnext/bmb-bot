import { getGoodsSellOrder, postGoodsBuy } from '../api/buff'
import { sendMessage } from '../api/telegram'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage } from '../utils'
import { getMaxPricesForXDays } from './getMaxPricesForXDays'

export const executeBuffToMicroSteamTrade = async (
  item: MarketGoodsItem,
  options: {
    source: Source
  }
) => {
  const goods_id = item.id

  const prices = await getMaxPricesForXDays(item.market_hash_name)
  const minSteamPrice = prices.length !== 0 ? Math.min(...prices) : 0

  const currentPrice = Number(item.sell_min_price)
  const steamPriceAfterFee = Math.max(minSteamPrice - 0.01 - minSteamPrice * 0.15, minSteamPrice - 0.01 - 0.02)
  const profitPercentage = ((steamPriceAfterFee - currentPrice) / currentPrice) * 100

  const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })
  const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

  console.log(item.market_hash_name, profitPercentage.toFixed(2) + '%')

  if (lowestPricedItem && profitPercentage > 80) {
    const keychain = lowestPricedItem.asset_info.info?.keychains?.[0]

    const stickerTotal = (lowestPricedItem.asset_info.info?.stickers || []).reduce((acc, sticker) => {
      return sticker.wear === 0 ? acc + Number(sticker.sell_reference_price) : acc
    }, 0)

    const payload = {
      id: goods_id,
      keychain: keychain,
      price: currentPrice,
      name: item.market_hash_name,
      type: MessageType.Purchased,
      medianPrice: minSteamPrice,
      estimatedProfit: profitPercentage,
      float: lowestPricedItem.asset_info.paintwear,
      stickerTotal: stickerTotal,
      source: options.source,
    }

    const response = await postGoodsBuy({ price: currentPrice, sell_order_id: lowestPricedItem.id })

    if (response.code !== 'OK') {
      sendMessage({
        text: `[${options.source}] Failed to purchase the item ${item.market_hash_name}. Reason: ${response.code}`,
      })

      return
    }

    sendMessage({
      text: generateMessage({ ...payload }),
    })
  }
}
