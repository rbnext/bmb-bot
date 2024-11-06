import { getMarketItemDetail } from '../api/buff'
import { GoodsSellOrderItem, OnSaleItem } from '../types'

export const getTotalStickerPrice = async (data: GoodsSellOrderItem | OnSaleItem) => {
  if (data.asset_info.info.stickers.length === 0) {
    return 0
  }

  const response = await getMarketItemDetail({
    sell_order_id: data.id,
    classid: data.asset_info.classid,
    instanceid: data.asset_info.instanceid,
    assetid: data.asset_info.assetid,
    contextid: data.asset_info.contextid,
  })

  return response.data.asset_info.stickers.reduce(
    (acc, { wear, sell_reference_price }) => (wear === 0 ? Number(sell_reference_price) + acc : acc),
    0
  )
}
