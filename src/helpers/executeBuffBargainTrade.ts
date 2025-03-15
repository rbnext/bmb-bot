import {
  getGoodsInfo,
  getGoodsSellOrder,
  getMarketGoodsBillOrder,
  getSentBargain,
  getUserStorePopup,
  postCreateBargain,
  postGoodsBuy,
} from '../api/buff'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage, getItemExterior, isLessThanXMinutes, median, sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { differenceInDays } from 'date-fns'
import { GOODS_SALES_THRESHOLD, STEAM_PURCHASE_THRESHOLD } from '../config'
import { getMaxPricesForXDays } from './getMaxPricesForXDays'
import { getBuyOrders, getCSFloatListings } from '../api/csfloat'

type BargainNotification = {
  sell_order_id: string
  telegram_message_id: number
}

const FLOAT_BLACKLIST = new Set<string>()
const BARGAIN_NOTIFICATIONS = new Map<string, BargainNotification>()
const SELLER_BLACKLIST: string[] = ['U1093134454', 'U1093468966', 'U1093218438', 'U1094529680']

export const executeBuffBargainTrade = async (
  item: MarketGoodsItem,
  options: {
    source: Source
  }
) => {
  const goods_id = item.id
  const current_price = Number(item.sell_min_price)

  // const { isMinimalWear, isFieldTested, isStatTrak } = getItemExterior(item.market_hash_name)

  const history = await getMarketGoodsBillOrder({ goods_id })

  const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
    return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
  })

  if (FLOAT_BLACKLIST.size === 0) {
    const pages = Array.from({ length: 5 }, (_, i) => i + 1)
    for (const page_num of pages) {
      const bargains = await getSentBargain({ page_num })
      for (const bargain of bargains.data.items) {
        if (bargain.asset_info.paintwear) FLOAT_BLACKLIST.add(bargain.asset_info.paintwear)
      }
      await sleep(2_500)
    }
  }

  if (BARGAIN_NOTIFICATIONS.size !== 0) {
    const bargains = await getSentBargain({})

    for (const [sell_order_id, value] of BARGAIN_NOTIFICATIONS) {
      const bargain = bargains.data.items.find((item) => item.sell_order_id === sell_order_id)

      if (bargain && (bargain.state === 5 || bargain.state === 2 || bargain.state === 3)) {
        await sendMessage({
          text: bargain.state_text,
          reply_to_message_id: value.telegram_message_id,
        }).then(() => {
          BARGAIN_NOTIFICATIONS.delete(sell_order_id)
          FLOAT_BLACKLIST.add(bargain.asset_info.paintwear)
        })
        await sleep(1_000) // delay between requests to telegram
      }
    }
  }

  const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })
  const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

  if (!lowestPricedItem) return
  if (!lowestPricedItem.allow_bargain) return
  if (!isLessThanXMinutes(lowestPricedItem.created_at, 1)) return
  if (FLOAT_BLACKLIST.has(lowestPricedItem.asset_info.paintwear)) return
  if (SELLER_BLACKLIST.includes(lowestPricedItem.user_id)) return

  const userStorePopup = await getUserStorePopup({ user_id: lowestPricedItem.user_id })

  if (userStorePopup.code !== 'OK') return
  if (Number(userStorePopup.data.bookmark_count) > 2) return

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
    type: MessageType.Bargain,
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
    const bargain_price = Number((Math.min(median_price, reference_price) * 0.9).toFixed(1))

    if (Number(keychain?.sell_reference_price || 0) + bargain_price >= Number(lowestPricedItem.price)) {
      const response = await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })

      if (response.code !== 'OK') {
        console.log('Error:', JSON.stringify(response))

        return
      }

      sendMessage({ text: generateMessage({ ...payload, type: MessageType.Purchased }) })
    } else if (
      Number(lowestPricedItem.price) > bargain_price &&
      Number(lowestPricedItem.lowest_bargain_price) < bargain_price
    ) {
      const response = await postCreateBargain({
        price: bargain_price,
        sell_order_id: lowestPricedItem.id,
      })

      if (response.code !== 'OK') {
        console.log('Error:', JSON.stringify(response))

        return
      }

      sendMessage({ text: generateMessage({ ...payload, bargainPrice: bargain_price }) }).then((message) => {
        BARGAIN_NOTIFICATIONS.set(lowestPricedItem.id, {
          sell_order_id: lowestPricedItem.id,
          telegram_message_id: message.result.message_id,
        })
        if (paintwear) {
          FLOAT_BLACKLIST.add(paintwear)
        }
      })
    } else {
      console.log(
        `No bargain: Lowest bargain price: $${lowestPricedItem.lowest_bargain_price}; Current bargain price: $${bargain_price}; Current price: $${current_price}`
      )
    }
  } else {
    const response = await getCSFloatListings({ market_hash_name: item.market_hash_name })
    const currentActiveBuyOrders = await getBuyOrders({ id: response.data[0].id })
    const simpleBuyOrders = currentActiveBuyOrders.filter((i) => !!i.market_hash_name)
    const lowestCSFloatItem = response.data[0]

    const lowestItemPrice = lowestCSFloatItem.price
    const highestBuyOrder = Math.max(...simpleBuyOrders.map((i) => i.price))
    const predictedPrice = lowestCSFloatItem.reference.predicted_price

    const overpayment = Number((((lowestItemPrice - predictedPrice) / predictedPrice) * 100).toFixed(2))

    console.log('Overpayment:', overpayment)

    if (simpleBuyOrders.length < 3 || overpayment >= 5) {
      return
    }

    const bargain_price = Number((Math.min(highestBuyOrder, lowestItemPrice * 0.9) / 100).toFixed(1))

    console.log('Bargain price:', bargain_price)

    if (Number(keychain?.sell_reference_price || 0) + bargain_price >= Number(lowestPricedItem.price)) {
      const response = await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })

      if (response.code !== 'OK') {
        console.log('Error:', JSON.stringify(response))

        return
      }

      sendMessage({
        text: generateMessage({ ...payload, source: Source.BUFF_EXPERIMENT, type: MessageType.Purchased }),
      })
    } else if (
      Number(lowestPricedItem.price) > bargain_price &&
      Number(lowestPricedItem.lowest_bargain_price) < bargain_price
    ) {
      const response = await postCreateBargain({
        price: bargain_price,
        sell_order_id: lowestPricedItem.id,
      })

      if (response.code !== 'OK') {
        console.log('Error:', JSON.stringify(response))

        return
      }

      const message = await sendMessage({
        text: generateMessage({ ...payload, bargainPrice: bargain_price, source: Source.BUFF_EXPERIMENT }),
      })

      if (paintwear) FLOAT_BLACKLIST.add(paintwear)
      BARGAIN_NOTIFICATIONS.set(lowestPricedItem.id, {
        sell_order_id: lowestPricedItem.id,
        telegram_message_id: message.result.message_id,
      })
    }
  }
}
