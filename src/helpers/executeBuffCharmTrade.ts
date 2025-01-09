import { getGoodsSellOrder, postGoodsBuy } from '../api/buff'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage } from '../utils'
import { sendMessage } from '../api/telegram'

export const executeBuffCharmTrade = async (
  item: MarketGoodsItem,
  options: {
    source: Source
  }
) => {
  const goods_id = item.id

  const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1, sort_by: 'created.desc' })

  for (const data of orders.data.items) {
    const current_price = Number(data.price)
    const pattern = data.asset_info.info.keychains[0].pattern

    console.log(item.market_hash_name, current_price, pattern)

    // if (pattern > 1000) {
    //   const response = await postGoodsBuy({ price: current_price, sell_order_id: data.id })

    //   if (response.code !== 'OK') {
    //     console.log('Error:', JSON.stringify(response))

    //     return
    //   }

    //   const payload = {
    //     id: goods_id,
    //     price: current_price,
    //     type: MessageType.Purchased,
    //     name: item.market_hash_name,
    //     createdAt: data.created_at,
    //     updatedAt: data.updated_at,
    //     source: options.source,
    //   }

    //   await sendMessage(generateMessage({ ...payload }))
    // }
  }
}
