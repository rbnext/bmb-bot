import { differenceInDays } from 'date-fns'
import {
  getBriefAsset,
  getGoodsInfo,
  getGoodsSellOrder,
  getMarketGoodsBillOrder,
  getMarketItemDetail,
  postGoodsBuy,
} from '../api/buff'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage, getTotalStickerPrice, median, priceDiff } from '../utils'
import { GOODS_SALES_THRESHOLD, REFERENCE_DIFF_THRESHOLD } from '../config'
import { sendMessage } from '../api/telegram'

export const executeBuffToBuffTrade = async (item: MarketGoodsItem) => {
  const goods_id = item.id
  const current_price = Number(item.sell_min_price)

  const history = await getMarketGoodsBillOrder({ goods_id })

  const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
    return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
  })

  if (salesLastWeek.length < GOODS_SALES_THRESHOLD) {
    return
  }

  const sales = salesLastWeek.map(({ price }) => Number(price))
  const median_price = median(sales.filter((price) => current_price * 2 > price))
  const estimated_profit = ((median_price * 0.975) / current_price - 1) * 100

  if (estimated_profit >= (current_price >= 5 ? 10 : 20)) {
    const goodsInfo = await getGoodsInfo({ goods_id })

    const goods_ref_price = Number(goodsInfo.data.goods_info.goods_ref_price)
    const currentReferencePriceDiff = priceDiff(goods_ref_price, current_price)

    const {
      data: {
        items: [lowestPricedItem],
      },
    } = await getGoodsSellOrder({ goods_id, max_price: item.sell_min_price })

    if (!lowestPricedItem) {
      await sendMessage(`Oops! Someone already bought the ${item.market_hash_name} item.`)

      return
    }

    const payload = {
      id: goods_id,
      price: current_price,
      name: item.market_hash_name,
      referencePrice: goods_ref_price,
      estimatedProfit: estimated_profit,
      medianPrice: median_price,
      float: lowestPricedItem.asset_info.paintwear,
      source: Source.BUFF_DEFAULT,
    }

    if (currentReferencePriceDiff >= REFERENCE_DIFF_THRESHOLD) {
      const {
        data: { cash_amount },
      } = await getBriefAsset()

      if (current_price > Number(cash_amount)) {
        await sendMessage(`Oops! You don't have enough funds to buy ${item.market_hash_name} item.`)

        return
      }

      const response = await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })

      if (response.code !== 'OK') {
        await sendMessage(`Failed to purchase the item ${item.market_hash_name}. Reason: ${response.code}`)

        return
      }

      await sendMessage(generateMessage({ type: MessageType.Purchased, ...payload }))
    } else if (lowestPricedItem.asset_info.info.stickers.length !== 0) {
      const details = await getMarketItemDetail({
        sell_order_id: lowestPricedItem.id,
        classid: lowestPricedItem.asset_info.classid,
        instanceid: lowestPricedItem.asset_info.instanceid,
        assetid: lowestPricedItem.asset_info.assetid,
        contextid: lowestPricedItem.asset_info.contextid,
      })

      const stickerValue = getTotalStickerPrice(details.data.asset_info.stickers)

      await sendMessage(generateMessage({ type: MessageType.Review, stickerValue, ...payload }))
    } else {
      await sendMessage(generateMessage({ type: MessageType.Review, ...payload }))
    }
  }
}
