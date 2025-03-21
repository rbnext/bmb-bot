import { differenceInDays } from 'date-fns'
import { getGoodsSellOrder, getMarketGoodsBillOrder } from '../api/buff'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage, median } from '../utils'
import { GOODS_SALES_THRESHOLD } from '../config'
import { sendMessage } from '../api/telegram'
import { getCSFloatListings } from '../api/csfloat'
import { executeBuffToSteamTrade } from './executeBuffToSteamTrade'

export const executeBuffToBuffTrade = async (
  item: MarketGoodsItem,
  options: {
    source: Source
    csFloatEnabled?: boolean
    pageNum?: number
  }
) => {
  const goods_id = item.id
  const currentPrice = Number(item.sell_min_price)

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
    price: currentPrice,
    name: item.market_hash_name,
    createdAt: lowestPricedItem.created_at,
    updatedAt: lowestPricedItem.updated_at,
    source: options.source,
    stickerTotal: stickerTotal,
    type: MessageType.Review,
  }

  if (item.market_hash_name.includes(' Pin') || item.market_hash_name.includes('Music Kit')) {
    await executeBuffToSteamTrade(item, { source: Source.BUFF_STEAM })
  } else if (salesLastWeek.length >= GOODS_SALES_THRESHOLD) {
    const sales = salesLastWeek.map(({ price }) => Number(price))
    const medianPrice = median(sales.filter((price) => currentPrice * 2 > price))
    const estimatedProfit = Number((((medianPrice - currentPrice) / currentPrice) * 100).toFixed(2))

    console.log(item.market_hash_name, estimatedProfit.toFixed(2))

    if (estimatedProfit >= 10) {
      sendMessage({ text: generateMessage({ ...payload, medianPrice, estimatedProfit }) })
    }
  } else if (options.csFloatEnabled && payload.float) {
    const listings = await getCSFloatListings({ market_hash_name: item.market_hash_name })

    if (listings.data.length < 10) {
      return
    }

    const price = listings.data[3].price
    const basePrice = listings.data[0].reference.base_price
    const medianPrice = Math.min(basePrice, price) / 100
    const estimatedProfit = Number((((medianPrice - currentPrice) / currentPrice) * 100).toFixed(2))

    console.log(item.market_hash_name, estimatedProfit.toFixed(2))

    if (estimatedProfit >= 10) {
      sendMessage({ text: generateMessage({ ...payload, medianPrice, estimatedProfit }) })
    }
  }
}
