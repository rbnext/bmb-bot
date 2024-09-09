import 'dotenv/config'

import {
  getBriefAsset,
  getGoodsInfo,
  getGoodsSellOrder,
  getMarketGoods,
  getMarketGoodsBillOrder,
  getMarketItemDetail,
  postCreateBargain,
  postGoodsBuy,
} from '../api/buff'
import { REFERENCE_DIFF_THRESHOLD, weaponGroups } from '../config'
import { MessageType, Source } from '../types'
import { generateMessage, getTotalStickerPrice, isLessThanThreshold, median, priceDiff, sleep } from '../utils'
import { format, differenceInDays } from 'date-fns'
import { sendMessage } from '../api/telegram'

export const GOODS_CACHE: Record<number, { price: number }> = {}

const buff2buff = async () => {
  let currentPage = 1
  const pagesToLoad = 13
  let hasNextPage = true

  try {
    do {
      const page_num = currentPage
      const category_group = weaponGroups.join(',')
      const marketGoods = await getMarketGoods({ category_group, page_num, sort_by: 'sell_num.desc' })

      if (marketGoods?.code === 'Internal Server Timeout') {
        await sendMessage(`Warning ${marketGoods.code}`)

        break
      }

      if (hasNextPage) {
        hasNextPage = currentPage < pagesToLoad
      }

      for (const item of marketGoods.data.items) {
        const goods_id = item.id
        const market_hash_name = item.market_hash_name
        const sell_min_price = item.sell_min_price

        const current_price = Number(sell_min_price)

        const now = format(new Date(), 'HH:mm:ss')

        if (goods_id in GOODS_CACHE && isLessThanThreshold(GOODS_CACHE[goods_id].price, current_price)) {
          GOODS_CACHE[goods_id].price = current_price

          continue
        }

        if (goods_id in GOODS_CACHE && GOODS_CACHE[goods_id].price !== current_price) {
          console.log(`${now}: ${market_hash_name} ${GOODS_CACHE[goods_id].price}$ -> ${current_price}$`)
        }

        if (goods_id in GOODS_CACHE && GOODS_CACHE[goods_id].price > current_price) {
          // Get all the most recent sales from the 'Sale History' tab.
          const history = await getMarketGoodsBillOrder({ goods_id })

          // Exclude global supply and items sold more than 7 days ago.
          const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
            return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
          })

          if (salesLastWeek.length >= 5) {
            const sales = salesLastWeek.map(({ price }) => Number(price))
            const median_price = median(sales.filter((price) => current_price * 2 > price))
            const estimated_profit = ((median_price * 0.975) / current_price - 1) * 100

            if (estimated_profit >= (current_price >= 5 ? 9 : 20)) {
              const goodsInfo = await getGoodsInfo({ goods_id })

              const goods_ref_price = Number(goodsInfo.data.goods_info.goods_ref_price)
              const currentReferencePriceDiff = priceDiff(goods_ref_price, current_price)

              const {
                data: {
                  items: [lowestPricedItem],
                },
              } = await getGoodsSellOrder({ goods_id, max_price: item.sell_min_price })

              if (!lowestPricedItem) {
                await sendMessage(
                  `Oops! Someone already bought the ${item.market_hash_name} item for $${current_price}!`
                )

                continue
              }

              const payload = {
                id: goods_id,
                name: item.market_hash_name,
                price: current_price,
                referencePrice: goods_ref_price,
                estimatedProfit: estimated_profit,
                medianPrice: median_price,
                float: lowestPricedItem.asset_info.paintwear,
                source: Source.BUFF2BUFF,
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
            } else if (estimated_profit >= 1 && current_price > 20 && current_price <= 40) {
              // TODO: Bargain
              const briefAsset = await getBriefAsset()

              if (+briefAsset.data.cash_amount >= 60) {
                const {
                  data: {
                    items: [lowestPricedItem],
                  },
                } = await getGoodsSellOrder({ goods_id, max_price: item.sell_min_price })

                if (!lowestPricedItem) {
                  await sendMessage(
                    `Oops! Someone already bought the ${item.market_hash_name} item for $${current_price}!`
                  )

                  continue
                }

                if (!lowestPricedItem.allow_bargain) {
                  await sendMessage(`Bargaining for the ${item.market_hash_name} item is not allowed.`)

                  continue
                }

                const goodsInfo = await getGoodsInfo({ goods_id })

                const lowest_bargain_price = +lowestPricedItem.lowest_bargain_price
                const estimated_bargain_profit = ((median_price * 0.975) / lowest_bargain_price - 1) * 100

                const goods_ref_price = Number(goodsInfo.data.goods_info.goods_ref_price)
                const currentReferencePriceDiff = priceDiff(goods_ref_price, lowest_bargain_price)

                const payload = {
                  id: goods_id,
                  name: item.market_hash_name,
                  medianPrice: median_price,
                  referencePrice: goods_ref_price,
                  price: lowest_bargain_price,
                  estimatedProfit: estimated_bargain_profit,
                  source: Source.BUFF2BUFF,
                }

                if (estimated_bargain_profit > 10 && currentReferencePriceDiff >= REFERENCE_DIFF_THRESHOLD) {
                  const response = await postCreateBargain({
                    price: lowest_bargain_price,
                    sell_order_id: lowestPricedItem.id,
                  })

                  if (response.code === 'OK') {
                    await sendMessage(generateMessage({ type: MessageType.Bargain, ...payload }))
                  } else {
                    await sendMessage(`Failed to send bargain to seller. Reason: ${response.code}`)
                  }
                }
              }
            } else {
              // TODO: Other cases
            }
          }

          await sleep(2_000)
        }

        GOODS_CACHE[goods_id] = { price: current_price }
      }

      if (hasNextPage) {
        await sleep(4_000)
      }
      console.log(
        format(new Date(), 'HH:mm:ss') + ' Page Number: ' + currentPage + ', Items: ' + marketGoods.data.items.length
      )
      currentPage += 1
    } while (hasNextPage)
  } catch (error) {
    console.log('Something went wrong', error)

    await sendMessage(error?.message ?? 'Something went wrong.')

    return
  }

  buff2buff()
}

buff2buff()
