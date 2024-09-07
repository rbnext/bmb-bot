import {
  getBriefAsset,
  getGoodsInfo,
  getGoodsSellOrder,
  getMarketGoods,
  getMarketGoodsBillOrder,
  getMarketItemDetail,
  postGoodsBuy,
} from './api/buff'
import { weaponGroups } from './config'
import { MarketPriceOverview } from './types'
import { isLessThanThreshold, median, priceDiff, sleep } from './utils'
import { format, differenceInDays } from 'date-fns'
import { sendMessage } from './api/telegram'

export const GOODS_CACHE: Record<number, { price: number }> = {}
export const MARKET_CACHE: Record<number, MarketPriceOverview> = {}

export const buff2buff = () => async () => {
  let currentPage = 1
  const pagesToLoad = 13
  let hasNextPage = true

  try {
    do {
      const page_num = currentPage
      //const exterior = exteriorGroups.join(',')
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
        const steam_price = item.goods_info.steam_price
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

            if (estimated_profit > 2) {
              const goodsInfo = await getGoodsInfo({ goods_id })
              const sellOrders = await getGoodsSellOrder({ goods_id, max_price: sell_min_price })

              const refPrice = Number(goodsInfo.data.goods_info.goods_ref_price)
              const referenceDiff = priceDiff(refPrice, current_price)

              const [lowestPricedItem] = sellOrders.data.items

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

              const isProfitable = estimated_profit >= 9 && referenceDiff >= 4

              const stickersTotalPrice = stickers.reduce((acc, st) => acc + +st.sell_reference_price, 0)

              if (isProfitable) {
                const briefAsset = await getBriefAsset()

                if (+lowestPricedItem.price > +briefAsset.data.cash_amount) {
                  await sendMessage('Oops! Not enough funds.')

                  break
                }

                await postGoodsBuy({ sell_order_id: lowestPricedItem.id, price: +lowestPricedItem.price })
              }

              await sendMessage(
                `${isProfitable ? '✅' : '❗'} ${market_hash_name}\n\n` +
                  `Buff price: ${current_price}$\n` +
                  `Steam price: ${steam_price}$\n` +
                  `Reference price: ${refPrice}$\n` +
                  `Float: ${lowestPricedItem?.asset_info?.paintwear}\n` +
                  `Estimated profit(%) **${estimated_profit.toFixed(2)}% if sale for ${median_price}$**\n` +
                  `Stickers total price: ${stickersTotalPrice.toFixed(2)}$\n` +
                  `Lowest bargain price: ${lowestPricedItem.lowest_bargain_price}$\n` +
                  `Buff market link: https://buff.market/market/goods/${goods_id}`
              )
            } else {
              console.log(`${now}: ${market_hash_name} estimated profit ${estimated_profit.toFixed(2)}%`)
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

    await sendMessage('Buff2buff bot is stopped working.')

    return
  }

  await sleep(10_000)

  buff2buff()
}

buff2buff()
