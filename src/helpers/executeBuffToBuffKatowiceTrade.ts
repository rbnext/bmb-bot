import { getGoodsInfo, getKatowice14, getMarketItemDetail } from '../api/buff'
import { MessageType, Source } from '../types'
import { generateMessage, isLessThanXMinutes, sleep } from '../utils'
import { sendMessage } from '../api/telegram'

const KATOWICE_IDS_CACHE: string[] = []

export const executeBuffToBuffKatowiceTrade = async () => {
  const goods = await getKatowice14({})

  const premium_goods = goods.data.items.filter((item) => {
    return isLessThanXMinutes(item.created_at, 1) && !KATOWICE_IDS_CACHE.includes(item.id)
  })

  for (const item of premium_goods) {
    const current_price = Number(item.price)
    const market_hash_name = goods.data.goods_infos[item.goods_id].market_hash_name

    const reference = await getGoodsInfo({ goods_id: item.goods_id })
    const goods_ref_price = Number(reference.data.goods_info.goods_ref_price)

    const details = await getMarketItemDetail({
      sell_order_id: item.id,
      classid: item.asset_info.classid,
      instanceid: item.asset_info.instanceid,
      assetid: item.asset_info.assetid,
      contextid: item.asset_info.contextid,
    })

    const total = details.data.asset_info.stickers.reduce((acc, current) => {
      return current.wear === 0 ? Number(current.sell_reference_price) + acc : acc
    }, 0)

    await sendMessage(
      generateMessage({
        type: MessageType.Review,
        source: Source.BUFF_KATOWICE,
        id: item.goods_id,
        price: current_price,
        name: market_hash_name,
        referencePrice: goods_ref_price,
        float: item.asset_info.paintwear,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        stickerValue: total,
        stickerPremium: item.sticker_premium,
      })
    )

    KATOWICE_IDS_CACHE.push(item.id)

    await sleep(2_000)
  }
}
