import 'dotenv/config'

import { format } from 'date-fns'
import { getBriefAsset, getGoodsSellOrder, getMarketGoods, postGoodsBuy } from '../api/buff'
import { generateMessage, sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { MessageType, Source } from '../types'
import { STEAM_PURCHASE_THRESHOLD } from '../config'
import { getMaxPricesForXDays } from '../helpers/getMaxPricesForXDays'

let lastMarketHashName: string | null = null

const buff2steam = async () => {
  const now = format(new Date(), 'HH:mm:ss')

  try {
    const marketGoods = await getMarketGoods({ quality: 'normal,strange,tournament', min_price: 1, max_price: 200 })

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

        console.log(`${now}: ${item.market_hash_name} diff ${diff.toFixed(2)}%`)

        if (diff >= STEAM_PURCHASE_THRESHOLD) {
          const sales = await getMaxPricesForXDays(item.market_hash_name)

          const min_steam_price = sales.length === 0 ? 0 : Math.min(...sales)
          const estimated_profit = ((min_steam_price - current_price) / current_price) * 100

          if (sales.length === 0 || STEAM_PURCHASE_THRESHOLD > estimated_profit) {
            console.log(`[${now}] ${item.market_hash_name} is not liquid. Skipping purchase.`)

            continue
          }

          const payload = {
            id: goods_id,
            price: current_price,
            estimatedProfit: estimated_profit,
            medianPrice: min_steam_price,
            name: item.market_hash_name,
            source: Source.BUFF_STEAM,
          }

          if (estimated_profit > 70) {
            const {
              data: {
                items: [lowestPricedItem],
              },
            } = await getGoodsSellOrder({ goods_id, max_price: item.sell_min_price })

            if (!lowestPricedItem) {
              await sendMessage(`Oops! Someone already bought the ${item.market_hash_name} item for $${current_price}!`)

              continue
            }

            const briefAsset = await getBriefAsset()

            if (current_price > +briefAsset.data.cash_amount) {
              await sendMessage(
                `Oops! You don't have enough funds to buy ${item.market_hash_name} for ${current_price}, profit ${estimated_profit}%.`
              )

              continue
            }

            const response = await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })

            if (response.code === 'OK') {
              await sendMessage(generateMessage({ type: MessageType.Purchased, ...payload }))
            } else {
              await sendMessage(`Failed to purchase the item ${item.market_hash_name}. Reason: ${response.code}`)
            }
          } else {
            await sendMessage(generateMessage({ type: MessageType.Review, ...payload }))
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

  buff2steam()
}

buff2steam()
