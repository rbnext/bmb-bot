import { differenceInDays } from 'date-fns'
import { getGoodsInfo, getGoodsSellOrder, getMarketGoodsBillOrder, getMarketItemDetail } from '../api/buff'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage, sleep } from '../utils'
import { GOODS_SALES_THRESHOLD } from '../config'
import { sendMessage } from '../api/telegram'

export const executeBuffToBuffStickerTrade = async (
  item: MarketGoodsItem,
  options: {
    source: Source
  }
) => {
  const goods_id = item.id

  const history = await getMarketGoodsBillOrder({ goods_id })

  const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
    return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
  })

  if (salesLastWeek.length < GOODS_SALES_THRESHOLD) {
    return
  }

  const goodsInfo = await getGoodsInfo({ goods_id })
  const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })

  const refPrice = Number(goodsInfo.data.goods_info.goods_ref_price)
  const goodsItems = orders.data.items.filter((item) => item.asset_info.info.stickers.length !== 0)

  for (const goodsItem of goodsItems) {
    const details = await getMarketItemDetail({
      classid: goodsItem.asset_info.classid,
      instanceid: goodsItem.asset_info.instanceid,
      assetid: goodsItem.asset_info.assetid,
      contextid: goodsItem.asset_info.contextid,
      sell_order_id: goodsItem.id,
    })

    const stickerValue = details.data.asset_info.stickers.reduce((acc, current) => {
      return current.wear === 0 ? Number(current.sell_reference_price) + acc : acc
    }, 0)

    if (stickerValue > Number(goodsItem.price)) {
      await sendMessage(
        generateMessage({
          id: goods_id,
          type: MessageType.Review,
          name: item.market_hash_name,
          source: options.source,
          referencePrice: refPrice,
          price: Number(goodsItem.price),
          stickerValue,
        })
      )
    }

    await sleep(3_000)
  }
}
