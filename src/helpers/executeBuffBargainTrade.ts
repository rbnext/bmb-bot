import {
  getGoodsInfo,
  getGoodsSellOrder,
  getMarketGoodsBillOrder,
  getSentBargain,
  getUserStorePopup,
  postCreateBargain,
} from '../api/buff'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage, isLessThanXMinutes, median, sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { differenceInDays } from 'date-fns'
import { GOODS_SALES_THRESHOLD, STEAM_PURCHASE_THRESHOLD } from '../config'
import { getMaxPricesForXDays } from './getMaxPricesForXDays'

type BargainNotification = {
  sell_order_id: string
  telegram_message_id: number
}

const FLOAT_BLACKLIST = new Set<string>()
const BARGAIN_NOTIFICATIONS = new Map<string, BargainNotification>()
const SELLER_BLACKLIST: string[] = ['U1093134454']

export const executeBuffBargainTrade = async (
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

  if (FLOAT_BLACKLIST.size === 0) {
    const pages = Array.from({ length: 10 }, (_, i) => i + 1)
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
        await sendMessage(bargain.state_text, value.telegram_message_id).then(() => {
          BARGAIN_NOTIFICATIONS.delete(sell_order_id)
        })
        await sleep(1_000) // delay between requests to telegram
      }
    }
  }

  if (salesLastWeek.length >= GOODS_SALES_THRESHOLD) {
    const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })

    const sales = salesLastWeek.map(({ price }) => Number(price))
    const median_price = median(sales.filter((price) => current_price * 2 > price))
    const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

    if (!lowestPricedItem) return
    if (!lowestPricedItem.allow_bargain) return
    if (!isLessThanXMinutes(lowestPricedItem.created_at, 1)) return
    if (FLOAT_BLACKLIST.has(lowestPricedItem.asset_info.instanceid)) return
    if (SELLER_BLACKLIST.includes(lowestPricedItem.user_id)) return

    const userStorePopup = await getUserStorePopup({ user_id: lowestPricedItem.user_id })

    if (userStorePopup.code !== 'OK') return
    if (Number(userStorePopup.data.bookmark_count) > 2) return

    const goodsInfo = await getGoodsInfo({ goods_id })
    const reference_price = Number(goodsInfo.data.goods_info.goods_ref_price)
    const bargain_price = Math.ceil(Number((Math.min(median_price, reference_price) * 0.875).toFixed(2)))
    const paintwear = lowestPricedItem.asset_info.paintwear

    if (
      Number(lowestPricedItem.price) > bargain_price &&
      Number(lowestPricedItem.lowest_bargain_price) < bargain_price
    ) {
      const response = await postCreateBargain({ price: bargain_price, sell_order_id: lowestPricedItem.id })

      if (response.code !== 'OK') {
        console.log('Error:', JSON.stringify(response))

        return
      }

      sendMessage(
        generateMessage({
          id: goods_id,
          type: MessageType.Bargain,
          price: current_price,
          bargainPrice: bargain_price,
          name: item.market_hash_name,
          float: lowestPricedItem.asset_info.paintwear,
          createdAt: lowestPricedItem.created_at,
          updatedAt: lowestPricedItem.updated_at,
          source: options.source,
        })
      ).then((message) => {
        BARGAIN_NOTIFICATIONS.set(lowestPricedItem.id, {
          sell_order_id: lowestPricedItem.id,
          telegram_message_id: message.result.message_id,
        })
        if (paintwear) {
          FLOAT_BLACKLIST.add(paintwear)
        }
      })
    }
  } else {
    const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })
    const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

    if (!lowestPricedItem) return
    if (!lowestPricedItem.allow_bargain) return
    if (!isLessThanXMinutes(lowestPricedItem.created_at, 1)) return
    if (FLOAT_BLACKLIST.has(lowestPricedItem.asset_info.instanceid)) return
    if (SELLER_BLACKLIST.includes(lowestPricedItem.user_id)) return

    const prices = await getMaxPricesForXDays(item.market_hash_name)
    const min_steam_price = prices.length !== 0 ? Math.min(...prices) : 0
    const bargain_price = Math.ceil(Number((min_steam_price / (1 + STEAM_PURCHASE_THRESHOLD / 100)).toFixed(2)))
    const paintwear = lowestPricedItem.asset_info.paintwear

    if (
      Number(lowestPricedItem.price) > bargain_price &&
      Number(lowestPricedItem.lowest_bargain_price) < bargain_price
    ) {
      const response = await postCreateBargain({ price: bargain_price, sell_order_id: lowestPricedItem.id })

      if (response.code !== 'OK') {
        console.log('Error:', JSON.stringify(response))

        return
      }

      sendMessage(
        generateMessage({
          id: goods_id,
          type: MessageType.Bargain,
          price: current_price,
          bargainPrice: bargain_price,
          name: item.market_hash_name,
          float: lowestPricedItem.asset_info.paintwear,
          createdAt: lowestPricedItem.created_at,
          updatedAt: lowestPricedItem.updated_at,
          steamPrice: min_steam_price,
          source: options.source,
        })
      ).then((message) => {
        BARGAIN_NOTIFICATIONS.set(lowestPricedItem.id, {
          sell_order_id: lowestPricedItem.id,
          telegram_message_id: message.result.message_id,
        })
        if (paintwear) {
          FLOAT_BLACKLIST.add(paintwear)
        }
      })
    }
  }
}
