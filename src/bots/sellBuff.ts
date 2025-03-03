import 'dotenv/config'

import {
  getBuyOrderHistory,
  getGoodsSellOrder,
  getItemsOnSale,
  getMarketBatchFee,
  getSentBargain,
  postCancelBargain,
  postSellOrderChange,
} from '../api/buff'
import { CURRENT_USER_ID } from '../config'
import { OnSaleItem, SellOrderItem, SellOrderPayload } from '../types'
import { sleep } from '../utils'
import { format } from 'date-fns'

const findByFloatAndMarketHash = async ({
  market_hash_name,
  paintwear,
}: {
  market_hash_name: string
  paintwear: string
}) => {
  const history = await getBuyOrderHistory({ search: market_hash_name })

  return history.data.items.find((item) => item.asset_info.paintwear === paintwear)
}

const getEstimatedProfit = (next_price: number | string, prev_price: number | string) => {
  return Number(((Number(next_price) / Number(prev_price) - 1) * 100).toFixed(2))
}

const sellOrdersEntity = (data: SellOrderPayload): SellOrderItem => {
  return {
    desc: data.desc,
    income: data.income,
    price: data.price,
    sell_order_id: data.sell_order_id,
  }
}

export const sellBuff = async () => {
  const pages = Array.from({ length: 50 }, (_, i) => i + 1)

  const sell_items: OnSaleItem[] = []
  const sell_orders: SellOrderPayload[] = []

  for (const page_num of pages) {
    const response = await getItemsOnSale({ page_num })

    for (const item of response.data.items) {
      if (
        item.asset_info.paintwear &&
        item.asset_info.info.stickers.length === 0 &&
        (!item.asset_info.info.keychains || item.asset_info.info.keychains.length === 0)
      ) {
        sell_items.push(item)
      }
    }

    if (response.data.items.length !== 40) {
      break
    }

    await sleep(10_000)
  }

  for (const item of sell_items) {
    const sell_order_id = item.id
    const goods_id = item.goods_id
    const response = await getGoodsSellOrder({ goods_id })
    await sleep(5_000)

    const current_index = response.data.items.findIndex(
      ({ user_id, asset_info }) => user_id === CURRENT_USER_ID && asset_info.paintwear === item.asset_info.paintwear
    )

    if (current_index === -1 || !response.data.items[current_index + 1]) {
      continue
    }

    const paintwear = item.asset_info.paintwear
    const next_user = response.data.items[current_index + 1].user_id
    const market_hash_name = response.data.goods_infos[goods_id].market_hash_name
    const current_price = Number(response.data.items[current_index].price)
    const payload = { sell_order_id, goods_id, prev_price: current_price, desc: '', income: 0 }

    const purchasedItem = await findByFloatAndMarketHash({ market_hash_name, paintwear })

    if (current_index === 0 && purchasedItem && next_user !== CURRENT_USER_ID) {
      const next_price = Number(response.data.items[current_index + 1].price)

      if (current_price === next_price) {
        sell_orders.push({ price: (current_price - 0.01).toFixed(2), ...payload })
      } else if (Number((next_price - current_price).toFixed(2)) > 0.01) {
        sell_orders.push({ price: (next_price - 0.01).toFixed(2), ...payload })
      }
    }

    if (current_index > 0 && purchasedItem) {
      const prev_user = response.data.items[current_index - 1].user_id

      const prev_price = Number(response.data.items[current_index - 1].price)
      const next_price = Number(response.data.items[current_index + 1].price)

      if (prev_user === CURRENT_USER_ID || next_user === CURRENT_USER_ID) {
        continue
      }

      if (prev_price === current_price || next_price === current_price) {
        const price = (current_price - 0.01).toFixed(2)
        const estimated_profit = getEstimatedProfit(price, purchasedItem.price)

        if (estimated_profit >= 5) sell_orders.push({ price, ...payload })
      } else {
        const price = (prev_price - 0.01).toFixed(2)
        const estimated_profit = getEstimatedProfit(price, purchasedItem.price)

        if (estimated_profit >= 5) sell_orders.push({ price, ...payload })
        else {
          const price = (next_price - 0.01).toFixed(2)
          if (Number(price) !== current_price) sell_orders.push({ price, ...payload })
        }
      }
    }

    await sleep(5_000)
  }

  for (const sell_order of sell_orders) {
    const now = format(new Date(), 'HH:mm:ss')
    const fee = await getMarketBatchFee({ goods_ids: String(sell_order.goods_id), prices: sell_order.price })
    sell_order.income = Number((Number(sell_order.price) - Number(fee.data.total_fee)).toFixed(2))
    console.log(`${now}: ${sell_order.goods_id} $${sell_order.prev_price} -> $${sell_order.price}`)
    await sleep(5_000)
  }

  if (sell_orders.length !== 0) {
    await postSellOrderChange({ sell_orders: sell_orders.map(sellOrdersEntity) })
  }

  // const sentBargains = await getSentBargain({})

  // for (const item of sentBargains.data.items) {
  //   if (item.can_cancel_timeout < -1) {
  //     await sleep(5_000)
  //     const now = format(new Date(), 'HH:mm:ss')
  //     const response = await postCancelBargain({ bargain_id: item.id })
  //     console.log(`${now}: bargain cancel timeout ${item.can_cancel_timeout}`)
  //     if (response.code !== 'OK') console.log(`${now}: failed to cancel bargain ${item.id}.`)
  //     else console.log(`${now}: bargain has been canceled ${item.id}.`)
  //   }
  // }

  await sleep(60_000 * 10)

  sellBuff()
}

sellBuff()
