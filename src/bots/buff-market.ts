import dotenv from 'dotenv'

dotenv.config()

import {
  getGoodsInfo,
  getGoodsSellOrder,
  getMarketGoods,
  getMarketGoodsBillOrder,
  postCreateBargain,
  postGoodsBuy,
} from '../api/buff'
import { generateMessage, isLessThanThreshold, median, sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { GOODS_SALES_THRESHOLD, STEAM_CHECK_THRESHOLD, STEAM_PURCHASE_THRESHOLD } from '../config'
import { getMaxPricesForXDays } from '../helpers/getMaxPricesForXDays'
import { differenceInDays } from 'date-fns'

export const GOODS_CACHE: Record<number, { price: number }> = {}
export const GOODS_BLACKLIST_CACHE: number[] = [30431, 30235, 30259, 30269, 30350]

const buffMarketTrade = async (item: MarketGoodsItem) => {
  const goods_id = item.id

  const currentPrice = Number(item.sell_min_price)
  const steamPrice = Number(item.goods_info.steam_price)

  const steamEstimatedProfit = ((steamPrice - currentPrice) / currentPrice) * 100

  const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })
  const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

  if (!lowestPricedItem) {
    return
  }

  const stickers = lowestPricedItem.asset_info.info?.stickers || []
  const isZeroWear = stickers.every((sticker) => sticker.wear === 0)
  const isTrueCombo = stickers.every((item) => item.name === stickers[0].name)

  const keychain = lowestPricedItem.asset_info.info?.keychains?.[0]
  const k_total = keychain ? Number(keychain.sell_reference_price) - 0.33 : 0

  const stickerTotal = stickers.reduce(
    (acc, sticker) => (sticker.wear === 0 ? acc + Number(sticker.sell_reference_price) : acc),
    0
  )

  const payload = {
    id: goods_id,
    keychain: keychain,
    price: currentPrice,
    name: item.market_hash_name,
    createdAt: lowestPricedItem.created_at,
    updatedAt: lowestPricedItem.updated_at,
    float: lowestPricedItem.asset_info.paintwear,
    type: MessageType.Purchased,
    stickerTotal: stickerTotal,
  }

  const purchasePayload = {
    price: currentPrice,
    sell_order_id: lowestPricedItem.id,
  }

  if (steamEstimatedProfit > STEAM_CHECK_THRESHOLD) {
    const prices = await getMaxPricesForXDays(item.market_hash_name)

    const medianPrice = prices.length !== 0 ? Math.min(...prices) : 0
    const estimatedProfit = ((medianPrice - (currentPrice - k_total)) / (currentPrice - k_total)) * 100

    if (estimatedProfit >= STEAM_PURCHASE_THRESHOLD) {
      const response = await postGoodsBuy(purchasePayload)

      if (response.code !== 'OK') {
        return
      }

      sendMessage({
        text: generateMessage({ ...payload, estimatedProfit, medianPrice, source: Source.BUFF_STEAM }),
      })

      return
    }
  }

  const goodsInfo = await getGoodsInfo({ goods_id })
  const history = await getMarketGoodsBillOrder({ goods_id })

  const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
    return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
  })

  const sales = salesLastWeek.map(({ price }) => Number(price))
  const referencePrice = Number(goodsInfo.data.goods_info.goods_ref_price)
  const medianPrice = median(sales.filter((price) => currentPrice * 2 > price))
  const buffPurchaseThreshold = Number((Math.min(medianPrice, referencePrice) * 0.9).toFixed(2))
  const lowestBargainPrice = Number(lowestPricedItem.lowest_bargain_price)

  if (salesLastWeek.length >= GOODS_SALES_THRESHOLD) {
    const estimatedProfit = Number((((medianPrice - currentPrice) / currentPrice) * 100).toFixed(2))

    if (buffPurchaseThreshold >= currentPrice) {
      const response = await postGoodsBuy(purchasePayload)

      if (response.code !== 'OK') {
        return
      }

      sendMessage({
        text: generateMessage({ ...payload, estimatedProfit, medianPrice, source: Source.BUFF_BUFF }),
      })

      return
    }
  }

  if (
    currentPrice >= 15 &&
    currentPrice > buffPurchaseThreshold &&
    salesLastWeek.length >= GOODS_SALES_THRESHOLD &&
    lowestBargainPrice < buffPurchaseThreshold
  ) {
    const response = await postCreateBargain({ price: buffPurchaseThreshold, sell_order_id: lowestPricedItem.id })

    if (response.code !== 'OK') {
      return
    }

    sendMessage({
      text: generateMessage({ ...payload, bargainPrice: buffPurchaseThreshold, source: Source.BUFF_BARGAIN }),
    })

    return
  }

  return
}

const buffMarket = async () => {
  try {
    const marketGoods = await getMarketGoods({
      min_price: Number(process.env.MIN_BARGAIN_PRICE),
      max_price: Number(process.env.MAX_BARGAIN_PRICE),
    })

    for (const item of marketGoods.data.items) {
      const current_price = Number(item.sell_min_price)

      if (GOODS_BLACKLIST_CACHE.includes(item.id) || item.is_charm) {
        continue
      }

      if (item.id in GOODS_CACHE && isLessThanThreshold(GOODS_CACHE[item.id].price, current_price, 0.1)) {
        GOODS_CACHE[item.id].price = current_price

        continue
      }

      if (item.id in GOODS_CACHE && GOODS_CACHE[item.id].price > current_price) {
        buffMarketTrade(item)
      }

      GOODS_CACHE[item.id] = { price: current_price }
    }

    await sleep(2_500)
  } catch (error) {
    console.log('Something went wrong', error)

    if (error.message !== 'Request failed with status code 503') {
      await sendMessage({ text: error?.message ?? 'Something went wrong.' })

      return
    }

    await sendMessage({ text: `${error.message}. Restarting in 60 seconds...` })
    await sleep(60_000)
  }

  buffMarket()
}

;(async () => {
  const pages = Array.from({ length: 80 }, (_, i) => i + 1)

  for (const page_num of pages) {
    const goods = await getMarketGoods({
      page_num,
      min_price: Number(process.env.MIN_BARGAIN_PRICE),
      max_price: Number(process.env.MAX_BARGAIN_PRICE),
    })
    for (const item of goods.data.items) GOODS_CACHE[item.id] = { price: Number(item.sell_min_price) }
    if (goods.data.items.length !== 50) break
    await sleep(3_000)
  }

  console.log('Loaded items: ', Object.keys(GOODS_CACHE).length)
  console.log('Disabled items: ', Object.keys(GOODS_BLACKLIST_CACHE).length)

  buffMarket()
})()
