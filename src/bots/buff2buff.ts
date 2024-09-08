import {
  getBriefAsset,
  getGoodsInfo,
  getGoodsSellOrder,
  getMarketGoods,
  getMarketGoodsBillOrder,
  getMarketItemDetail,
  postGoodsBuy,
} from '../api/buff'
import { REFERENCE_DIFF_THRESHOLD, weaponGroups } from '../config'
import { MarketPriceOverview, MessageType } from '../types'
import { generateMessage, getTotalStickerPrice, isLessThanThreshold, median, priceDiff, sleep } from '../utils'
import { format, differenceInDays } from 'date-fns'
import { sendMessage } from '../api/telegram'

export const GOODS_CACHE: Record<number, { price: number }> = {}
export const MARKET_CACHE: Record<number, MarketPriceOverview> = {}

export const buff2buff = () => async () => {
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
      //console.log('Items: ', marketGoods.data.items.length, ' Page Number:',page_num)
      if (hasNextPage) {
        hasNextPage = currentPage < pagesToLoad
      }

      for (const item of marketGoods.data.items) {
        const goods_id = item.id
        const market_hash_name = item.market_hash_name
        const sell_min_price = item.sell_min_price

        const current_price = Number(sell_min_price)

        const now = format(new Date(), 'dd MMM yyyy, HH:mm')

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
                throw new Error('Oops! Someone already bought this item!')
              }

              const payload = {
                id: goods_id,
                name: item.market_hash_name,
                price: current_price,
                referencePrice: goods_ref_price,
                estimatedProfit: estimated_profit,
                medianPrice: median_price,
                float: lowestPricedItem.asset_info.paintwear,
              }

              if (currentReferencePriceDiff >= REFERENCE_DIFF_THRESHOLD) {
                const briefAsset = await getBriefAsset()

                if (current_price > +briefAsset.data.cash_amount) {
                  throw new Error('Oops! Not enough funds on your account.')
                }

                await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })
                await sendMessage(generateMessage({ type: MessageType.Purchased, ...payload }))
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
            } else if (estimated_profit >= 2 && current_price > 20) {
              // TODO: Bargain
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
