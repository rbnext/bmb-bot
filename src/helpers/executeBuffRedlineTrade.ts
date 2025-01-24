import { getGoodsSellOrder, postGoodsBuy } from '../api/buff'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage } from '../utils'
import { sendMessage } from '../api/telegram'

export const executeBuffRedlineTrade = async (
  item: MarketGoodsItem,
  options: {
    source: Source
  }
) => {
  const goods_id = item.id

  const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1, sort_by: 'created.desc' })

  for (const data of orders.data.items) {
    const current_price = Number(data.price)
    const float = Number(data.asset_info.paintwear) || 1

    console.log(item.market_hash_name, current_price, float)

    if ((float < 0.18 && current_price <= 35) || (float < 0.2 && current_price <= 30)) {
      const response = await postGoodsBuy({ price: current_price, sell_order_id: data.id })

      if (response.code !== 'OK') {
        console.log('Error:', JSON.stringify(response))

        return
      }

      const payload = {
        id: goods_id,
        price: current_price,
        type: MessageType.Purchased,
        name: item.market_hash_name,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        source: options.source,
        float: data.asset_info.paintwear,
      }

      await sendMessage(generateMessage({ ...payload }))

      return
    }
  }
}
