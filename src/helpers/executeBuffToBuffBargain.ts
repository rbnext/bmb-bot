import { differenceInDays } from 'date-fns'
import {
  getBriefAsset,
  getCreatePreviewBargain,
  getGoodsSellOrder,
  getMarketGoodsBillOrder,
  getUserStorePopup,
  postCreateBargain,
} from '../api/buff'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage, median, sleep } from '../utils'
import { BARGAIN_PROFIT_THRESHOLD, GOODS_SALES_THRESHOLD } from '../config'
import { sendMessage } from '../api/telegram'

const BARGAIN_OFFER_IDS_CACHE: string[] = []

export const executeBuffToBuffBargain = async (item: MarketGoodsItem) => {
  const goods_id = item.id
  const current_price = Number(item.sell_min_price)

  const history = await getMarketGoodsBillOrder({ goods_id })

  const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
    return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
  })

  if (salesLastWeek.length > GOODS_SALES_THRESHOLD) {
    const assets = await getBriefAsset()

    await sleep(3_000)

    if (Number(assets.data.cash_amount) > current_price) {
      const {
        data: {
          items: [lowestPricedItem],
        },
      } = await getGoodsSellOrder({ goods_id, exclude_current_user: 1, max_price: item.sell_min_price })

      const sales = salesLastWeek.map(({ price }) => Number(price))
      const median_price = median(sales.filter((price) => current_price * 2 > price))
      const desired_price = Number((median_price - (median_price * BARGAIN_PROFIT_THRESHOLD) / 100).toFixed(2))

      if (
        lowestPricedItem &&
        lowestPricedItem.allow_bargain &&
        desired_price > Number(lowestPricedItem.lowest_bargain_price) &&
        current_price > desired_price &&
        !BARGAIN_OFFER_IDS_CACHE.includes(lowestPricedItem.id)
      ) {
        const user = await getUserStorePopup({ user_id: lowestPricedItem.user_id })

        if (user.data.bookmark_count === 0) {
          const payload = { sell_order_id: lowestPricedItem.id, price: desired_price }

          const previewBargain = await getCreatePreviewBargain(payload)
          if (previewBargain.code !== 'OK') {
            await sendMessage(
              `Something went wrong! Failed to create bargain preview for ${item.market_hash_name} item. Current/desired price: ${current_price}/${desired_price}. Reason: ${previewBargain.code}`
            )

            return
          }

          const createBargain = await postCreateBargain(payload)
          if (createBargain.code !== 'OK') {
            await sendMessage(
              `Something went wrong! Failed to create bargain for ${item.market_hash_name} item. Current/desired price: ${current_price}/${desired_price}. Reason: ${createBargain.code}`
            )

            return
          }

          await sendMessage(
            generateMessage({
              id: goods_id,
              price: desired_price,
              name: item.market_hash_name,
              type: MessageType.Bargain,
              source: Source.BUFF_BARGAIN,
              medianPrice: median_price,
              estimatedProfit: BARGAIN_PROFIT_THRESHOLD,
            })
          )

          BARGAIN_OFFER_IDS_CACHE.push(lowestPricedItem.id)
        } else {
          await sendMessage(
            `Unable to initiate a bargain for "${item.market_hash_name}". The buyer with the nickname @${user.data.user.nickname} has ${user.data.bookmark_count} subscribers.`
          )
        }
      } else {
        await sendMessage(
          `Unable to initiate a bargain for "${item.market_hash_name}". Desired price (${desired_price}) is lower than the required bargain price (${lowestPricedItem ? lowestPricedItem.lowest_bargain_price : 'N/A'}).`
        )
      }
    }
  }

  await sleep(5_000)
}
