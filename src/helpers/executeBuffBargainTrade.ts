import {
  getGoodsInfo,
  getGoodsSellOrder,
  getMarketGoodsBillOrder,
  getSentBargain,
  getUserStorePopup,
  postCreateBargain,
} from '../api/buff'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage, median, sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { differenceInDays } from 'date-fns'
import { GOODS_SALES_THRESHOLD } from '../config'

type BargainNotification = {
  sell_order_id: string
  telegram_message_id: number
}

const SENT_GOODS_IDS: string[] = []
const BARGAIN_NOTIFICATIONS = new Map<string, BargainNotification>()

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

  if (BARGAIN_NOTIFICATIONS.size !== 0) {
    const sentBargains = await getSentBargain({})

    for (const [sell_order_id, value] of BARGAIN_NOTIFICATIONS) {
      const bargain = sentBargains.data.items.find((item) => item.sell_order_id === sell_order_id)

      if (bargain && (bargain.state === 5 || bargain.state === 2 || bargain.state === 3)) {
        await sendMessage(bargain.state_text, value.telegram_message_id).then(() => {
          BARGAIN_NOTIFICATIONS.delete(sell_order_id)
        })
        await sleep(1_000) // delay between requests to telegram
      }
    }
  }

  if (salesLastWeek.length > GOODS_SALES_THRESHOLD) {
    const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })

    const sales = salesLastWeek.map(({ price }) => Number(price))
    const median_price = median(sales.filter((price) => current_price * 2 > price))
    const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

    if (!lowestPricedItem) return
    if (!lowestPricedItem.allow_bargain) return
    if (SENT_GOODS_IDS.includes(lowestPricedItem.id)) return

    SENT_GOODS_IDS.push(lowestPricedItem.id)

    const userStorePopup = await getUserStorePopup({ user_id: lowestPricedItem.user_id })

    if (userStorePopup.code !== 'OK') return
    if (Number(userStorePopup.data.bookmark_count) > 2) return

    const goodsInfo = await getGoodsInfo({ goods_id })
    const reference_price = Number(goodsInfo.data.goods_info.goods_ref_price)

    const bargain_price = Number((Math.min(median_price, reference_price) * 0.875).toFixed(2))

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
      })
    }
  }
}
