import { getGoodsSellOrder, postGoodsBuy } from '../api/buff'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage } from '../utils'
import { sendMessage } from '../api/telegram'

export const executeFastBuffTrade = async (
  item: MarketGoodsItem,
  options: {
    source: Source
  }
) => {
  const goods_id = item.id
  const current_price = Number(item.sell_min_price)

  const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })

  const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

  if (!lowestPricedItem) {
    await sendMessage(
      `[${options.source}] Someone already bought the ${item.market_hash_name} item for $${current_price}.`
    )

    return
  }

  const payload = {
    id: goods_id,
    price: current_price,
    name: item.market_hash_name,
    float: lowestPricedItem.asset_info.paintwear,
    createdAt: lowestPricedItem.created_at,
    updatedAt: lowestPricedItem.updated_at,
    source: options.source,
  }

  const response = await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })

  if (response.code !== 'OK') {
    await sendMessage(
      `[${options.source}] Failed to purchase the item ${item.market_hash_name}. Reason: ${response.code}`
    )

    return
  }

  await sendMessage(generateMessage({ type: MessageType.Purchased, ...payload }))
}
