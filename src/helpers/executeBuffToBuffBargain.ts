import { differenceInDays } from 'date-fns'
import {
  getCreatePreviewBargain,
  getGoodsInfo,
  getGoodsSellOrder,
  getMarketGoodsBillOrder,
  getUserStorePopup,
  postCreateBargain,
} from '../api/buff'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage, isLessThanXMinutes, median } from '../utils'
import {
  BARGAIN_PROFIT_THRESHOLD,
  BUFF_PURCHASE_THRESHOLD,
  GOODS_SALES_THRESHOLD,
  REFERENCE_DIFF_THRESHOLD,
} from '../config'
import { sendMessage } from '../api/telegram'

const BARGAIN_OFFER_IDS_CACHE: string[] = []

export const executeBuffToBuffBargain = async (
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

  const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })

  const lastAddedItem = orders.data.items.sort((a, b) => b.created_at - a.created_at)[0]

  if (
    lastAddedItem &&
    lastAddedItem.allow_bargain &&
    isLessThanXMinutes(lastAddedItem.created_at) &&
    !BARGAIN_OFFER_IDS_CACHE.includes(lastAddedItem.id)
  ) {
    const current_price = Number(lastAddedItem.price)
    const sales = salesLastWeek.map(({ price }) => Number(price))
    const median_price = median(sales.filter((price) => current_price * 2 > price))
    const estimated_profit = ((median_price * 0.975) / current_price - 1) * 100
    const desired_price = Number((median_price - (median_price * BARGAIN_PROFIT_THRESHOLD) / 100).toFixed(2))
    const lowest_bargain_price = Number(lastAddedItem.lowest_bargain_price)

    if (estimated_profit >= 5 && estimated_profit < BUFF_PURCHASE_THRESHOLD && desired_price > lowest_bargain_price) {
      const goodsInfo = await getGoodsInfo({ goods_id })
      const user = await getUserStorePopup({ user_id: lastAddedItem.user_id })

      const goods_ref_price = Number(goodsInfo.data.goods_info.goods_ref_price)
      const referencePriceDiff = (goods_ref_price / desired_price - 1) * 100

      if (referencePriceDiff < REFERENCE_DIFF_THRESHOLD || user.code !== 'OK' || user.data.bookmark_count >= 2) {
        return
      }

      const previewBargain = await getCreatePreviewBargain({ sell_order_id: lastAddedItem.id, price: desired_price })

      if (previewBargain.code !== 'OK' || previewBargain?.data?.pay_confirm?.id === 'bargain_higher_price') {
        return
      }

      const pay_methods = previewBargain?.data?.pay_methods ?? []
      const desired_pay_method = pay_methods.find((item) => item.value === 12)

      if (desired_pay_method && !desired_pay_method.enough) {
        await sendMessage(`[${options.source}] Reason(preview bargain): ${desired_pay_method.error}.`)

        return
      }

      const createBargain = await postCreateBargain({ sell_order_id: lastAddedItem.id, price: desired_price })

      if (createBargain.code !== 'OK') {
        await sendMessage(`[${options.source}] Reason(create bargain): ${createBargain.code}.`)

        return
      }

      const payload = {
        id: goods_id,
        price: desired_price,
        name: item.market_hash_name,
        type: MessageType.Bargain,
        source: options.source,
        medianPrice: median_price,
        estimatedProfit: BARGAIN_PROFIT_THRESHOLD,
        referencePrice: goods_ref_price,
        float: lastAddedItem.asset_info.paintwear,
        createdAt: lastAddedItem.created_at,
        updatedAt: lastAddedItem.updated_at,
      }

      await sendMessage(generateMessage(payload))

      BARGAIN_OFFER_IDS_CACHE.push(lastAddedItem.id)
    }
  }
}
