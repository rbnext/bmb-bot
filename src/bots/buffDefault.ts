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
import { generateMessage, getTotalStickerPrice, median, priceDiff, sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { MessageType, Source } from '../types'
import { REFERENCE_DIFF_THRESHOLD } from '../config'

let lastMarketHashName: string | null = null

const buffDefault = async () => {
  const now = format(new Date(), 'HH:mm:ss')

  try {
    const marketGoods = await getMarketGoods({ quality: 'normal,strange,tournament' })

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
        const steam_price = +item.goods_info.steam_price
        const diff = ((steam_price - current_price) / current_price) * 100

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
              await sendMessage(`Oops! Someone already bought the ${item.market_hash_name} item for $${current_price}!`)

              continue
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
              const briefAsset = await getBriefAsset()

              if (current_price > +briefAsset.data.cash_amount) {
                throw new Error('Oops! Not enough funds on your account.')
              }

              const response = await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })

              if (response.code === 'OK') {
                await sendMessage(generateMessage({ type: MessageType.Purchased, ...payload }))
              } else {
                await sendMessage(`Failed to purchase the item ${item.market_hash_name}. Reason: ${response.code}`)
              }
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
          } else if (estimated_profit > 0 && current_price > 20) {
            // TODO: Bargain
          } else {
            // TODO: Other cases
          }
        } else if (diff >= 60) {
          const payload = {
            id: goods_id,
            price: current_price,
            stemPrice: steam_price,
            estimatedProfit: diff,
            medianPrice: steam_price,
            name: item.market_hash_name,
            source: Source.BUFF_STEAM,
            type: MessageType.Review,
          }

          await sendMessage(generateMessage(payload))
        } else {
          // TODO
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
