import { format } from 'date-fns'
import { getGoodsSellOrder, postGoodsBuy } from '../api/buff'
import { sendMessage } from '../api/telegram'
import { STEAM_CHECK_THRESHOLD, STEAM_PURCHASE_THRESHOLD } from '../config'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage } from '../utils'
import { getMaxPricesForXDays } from './getMaxPricesForXDays'

export const executeBuffToSteamTrade = async (
  item: MarketGoodsItem,
  options: {
    source: Source
  }
) => {
  // vercelHealthCheck()

  const goods_id = item.id
  const current_price = Number(item.sell_min_price)
  const steam_price = Number(item.goods_info.steam_price)

  const diffWithSteam = ((steam_price - current_price) / current_price) * 100

  if (STEAM_CHECK_THRESHOLD > diffWithSteam) {
    return
  }

  const now = format(new Date(), 'HH:mm:ss')

  const prices = await getMaxPricesForXDays(item.market_hash_name)

  const min_steam_price = prices.length !== 0 ? Math.min(...prices) : 0
  const estimated_profit = ((min_steam_price - current_price) / current_price) * 100

  console.log('***')
  console.log(`${now}: ${item.market_hash_name} min steam price $${min_steam_price.toFixed(2)}`)
  console.log(`${now}: ${item.market_hash_name} estimated profit ${estimated_profit.toFixed(2)}%`)
  console.log('***')

  if (
    (current_price < 2 && estimated_profit >= STEAM_PURCHASE_THRESHOLD + 30) ||
    (current_price >= 2 && estimated_profit >= STEAM_PURCHASE_THRESHOLD)
  ) {
    const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })

    const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

    if (!lowestPricedItem) {
      await sendMessage(
        `[${options.source}] Someone already bought the ${item.market_hash_name} item for $${current_price} with profit ${estimated_profit.toFixed(2)}%`
      )

      return
    }

    const response = await postGoodsBuy({ price: current_price, sell_order_id: lowestPricedItem.id })

    if (response.code !== 'OK') {
      await sendMessage(
        `[${options.source}] Failed to purchase the item ${item.market_hash_name}. Reason: ${response.code}`
      )

      return
    }

    sendMessage(
      generateMessage({
        id: goods_id,
        price: current_price,
        type: MessageType.Purchased,
        name: item.market_hash_name,
        createdAt: lowestPricedItem.created_at,
        updatedAt: lowestPricedItem.updated_at,
        estimatedProfit: estimated_profit,
        medianPrice: min_steam_price,
        float: lowestPricedItem.asset_info.paintwear,
        source: options.source,
      })
    )
  }

  // else if (current_price >= 5 && estimated_profit >= STEAM_PURCHASE_THRESHOLD - 8) {
  //   const orders = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })

  //   const lowestPricedItem = orders.data.items.find((el) => el.price === item.sell_min_price)

  //   if (!lowestPricedItem) {
  //     await sendMessage(
  //       `[${Source.BUFF_DEFAULT}] Someone already bought the ${item.market_hash_name} item for $${current_price}.`
  //     )

  //     return
  //   }

  //   const response = await createVercelPurchase({ price: current_price, sell_order_id: lowestPricedItem.id })

  //   if (response.code !== 'OK') {
  //     await sendMessage(
  //       `[${Source.BUFF_DEFAULT}] Failed to purchase the item ${item.market_hash_name}. Reason: ${response.code}`
  //     )

  //     return
  //   }

  //   await sleep(3_000)

  //   const goods_info = await getGoodsInfo({ goods_id })
  //   const history = await getMarketGoodsBillOrder({ goods_id })

  //   const sales = history.data.items.map(({ price }) => Number(price))
  //   const median_price = median(sales.filter((price) => current_price * 2 > price))
  //   const estimated_profit = ((median_price * 0.975) / current_price - 1) * 100

  //   const goods_ref_price = Number(goods_info.data.goods_info.goods_ref_price)
  //   const ref_price_delta = (goods_ref_price / current_price - 1) * 100

  //   await sendMessage(
  //     generateMessage({
  //       id: goods_id,
  //       price: current_price,
  //       type: MessageType.Purchased,
  //       source: Source.BUFF_DEFAULT,
  //       name: item.market_hash_name,
  //       createdAt: lowestPricedItem.created_at,
  //       updatedAt: lowestPricedItem.updated_at,
  //       estimatedProfit: estimated_profit,
  //       medianPrice: median_price,
  //       float: lowestPricedItem.asset_info.paintwear,
  //       referencePrice: goods_ref_price,
  //       refPriceDelta: ref_price_delta,
  //     })
  //   )
  // }
}
