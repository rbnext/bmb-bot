import { getBuyOrderHistory, getMarketBatchFee, postSellOrderChange } from '../api/buff'
import { sendMessage } from '../api/telegram'

export const executePriceChange = async ({
  goods_id,
  market_hash_name,
  price,
  prev_price,
  sell_order_id,
  assetid,
  classid,
}: {
  goods_id: number
  market_hash_name: string
  price: string
  prev_price: number
  sell_order_id: string
  assetid: string
  classid: string
}) => {
  const history = await getBuyOrderHistory({ search: market_hash_name })

  const purchasedItem = history.data.items.find(
    (item) => item.asset_info.assetid === assetid && item.asset_info.classid === classid
  )

  const estimated_profit = purchasedItem ? (Number(price) / Number(purchasedItem.price) - 1) * 100 : 0

  if (purchasedItem && estimated_profit > 5) {
    const fee = await getMarketBatchFee({ goods_ids: `${goods_id}`, prices: price })

    const sell_orders = [
      {
        desc: '',
        income: (Number(price) - Number(fee.data.total_fee)).toFixed(2),
        price,
        sell_order_id,
      },
    ]

    await postSellOrderChange({ sell_orders })

    await sendMessage(
      `<a href="https://buff.market/market/goods/${goods_id}">${market_hash_name}</a> ($${prev_price} -> $${price})`
    )
  }
}
