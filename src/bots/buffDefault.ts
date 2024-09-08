import 'dotenv/config'

import { differenceInDays, format } from 'date-fns'
import {
  getBriefAsset,
  getGoodsInfo,
  getGoodsSellOrder,
  getMarketGoods,
  getMarketGoodsBillOrder,
  getMarketItemDetail,
  postGoodsBuy,
} from '../api/buff'
import { generateMessage, median, priceDiff, sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { MessageType } from '../types'

let lastMarketHashName: string | null = null

const buffDefault = async () => {
  const now = format(new Date(), 'dd MMM yyyy, HH:mm')

  try {
    const marketGoods = await getMarketGoods({ quality: 'normal,strange,tournament', min_price: 1, max_price: 100 })

    const items = marketGoods.data.items.slice(0, 4)

    if (!lastMarketHashName) {
      lastMarketHashName = items[0].market_hash_name
    }

    if (lastMarketHashName) {
      for (const item of items) {
        if (item.market_hash_name === lastMarketHashName) {
          break
        }

        const goods_id = item.id
        const current_price = +item.sell_min_price

        const history = await getMarketGoodsBillOrder({ goods_id })

        const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
          return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
        })

        if (salesLastWeek.length >= 5) {
          const sales = salesLastWeek.map(({ price }) => Number(price))
          const median_price = median(sales.filter((price) => current_price * 2 > price))
          const estimated_profit = ((median_price * 0.975) / current_price - 1) * 100

          console.log(`${now}: ${item.market_hash_name} estimated profit ${estimated_profit.toFixed(2)}%`)

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
              throw new Error('Oops! Someone already bought this item!')
            }

            const payload = {
              id: goods_id,
              price: current_price,
              name: item.market_hash_name,
              referencePrice: goods_ref_price,
              estimatedProfit: estimated_profit,
              medianPrice: median_price,
              float: lowestPricedItem.asset_info.paintwear,
            }

            if (currentReferencePriceDiff >= 4) {
              const briefAsset = await getBriefAsset()

              if (current_price > +briefAsset.data.cash_amount) {
                throw new Error('Oops! Not enough funds on your account.')
              }

              await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })
              await sendMessage(generateMessage({ type: MessageType.Purchased, ...payload }))
            } else if (lowestPricedItem.asset_info.info.stickers.length !== 0) {
              const {
                data: {
                  asset_info: { stickers },
                },
              } = await getMarketItemDetail({
                sell_order_id: lowestPricedItem.id,
                classid: lowestPricedItem.asset_info.classid,
                instanceid: lowestPricedItem.asset_info.instanceid,
                assetid: lowestPricedItem.asset_info.assetid,
                contextid: lowestPricedItem.asset_info.contextid,
              })

              const stickerValue = stickers.reduce((acc, { wear, sell_reference_price }) => {
                return wear === 0 ? acc + Number(sell_reference_price) : acc
              }, 0)

              await sendMessage(generateMessage({ type: MessageType.Review, stickerValue, ...payload }))
            } else {
              await sendMessage(generateMessage({ type: MessageType.Review, ...payload }))
            }
          }
        }

        await sleep(1_000)
      }

      lastMarketHashName = items[0].market_hash_name
    }
  } catch (error) {
    console.log('Something went wrong', error)

    await sendMessage(error?.message ?? 'Something went wrong.')

    return
  }

  await sleep(10_000)

  buffDefault()
}

buffDefault()
