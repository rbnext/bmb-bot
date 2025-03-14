import { differenceInDays } from 'date-fns'
import { getGoodsInfo, getGoodsSellOrder, getMarketGoodsBillOrder, postGoodsBuy } from '../api/buff'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage, median } from '../utils'
import { GOODS_SALES_THRESHOLD } from '../config'
import { sendMessage } from '../api/telegram'

export const executeBuffToBuffTrade = async (
  item: MarketGoodsItem,
  options: {
    source: Source
  }
) => {
  const goods_id = item.id
  const current_price = Number(item.sell_min_price)

  const history = await getMarketGoodsBillOrder({ goods_id })

  const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
    return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
  })

  const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })
  const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

  if (!lowestPricedItem) return

  const paintwear = lowestPricedItem.asset_info.paintwear
  const keychain = lowestPricedItem.asset_info.info?.keychains?.[0]
  const stickerTotal = (lowestPricedItem.asset_info.info?.stickers || []).reduce((acc, sticker) => {
    return sticker.wear === 0 ? acc + Number(sticker.sell_reference_price) : acc
  }, 0)

  const payload = {
    id: goods_id,
    float: paintwear,
    keychain: keychain,
    price: current_price,
    name: item.market_hash_name,
    createdAt: lowestPricedItem.created_at,
    updatedAt: lowestPricedItem.updated_at,
    source: options.source,
    stickerTotal: stickerTotal,
  }

  if (salesLastWeek.length >= GOODS_SALES_THRESHOLD) {
    const sales = salesLastWeek.map(({ price }) => Number(price))
    const median_price = median(sales.filter((price) => current_price * 2 > price))

    const goodsInfo = await getGoodsInfo({ goods_id })
    const reference_price = Number(goodsInfo.data.goods_info.goods_ref_price)
    const threshold_price = Number((Math.min(median_price, reference_price) * 0.9).toFixed(2))

    console.log(
      `|__ ${item.market_hash_name} current price: $${lowestPricedItem.price}; threshold price: $${threshold_price}`
    )

    if (threshold_price >= Number(lowestPricedItem.price)) {
      const response = await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })

      if (response.code !== 'OK') {
        console.log('Error:', JSON.stringify(response))

        return
      }

      sendMessage({ text: generateMessage({ ...payload, type: MessageType.Purchased }) })
    }
  } else {
    console.log(`|__ ${item.market_hash_name} not enough sales ${salesLastWeek.length}`)
  }
}
