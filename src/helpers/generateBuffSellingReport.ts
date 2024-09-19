import { getGoodsSellOrder, getItemsOnSale, getMarketBatchFee, postSellOrderChange } from '../api/buff'
import { sendMessage } from '../api/telegram'
import { sleep } from '../utils'

export const generateBuffSellingReport = async () => {
  try {
    const itemsOnSale = await getItemsOnSale({})

    for (const item of itemsOnSale.data.items) {
      const sellingList = await getGoodsSellOrder({ goods_id: item.goods_id })

      const index = sellingList.data.items.findIndex((el) => el.user_id === 'U1092757843')

      if (index === 0) {
        const price = (Number(sellingList.data.items[1].price) - 0.01).toFixed(2)
        const currentDiff = Number((+sellingList.data.items[1].price - +sellingList.data.items[index].price).toFixed(2))

        if (currentDiff > 0.01) {
          const goods_ids = `${sellingList.data.items[index].goods_id}`
          const fee = await getMarketBatchFee({ goods_ids, prices: price })

          const sell_orders = [
            {
              desc: '',
              income: (Number(price) - Number(fee.data.total_fee)).toFixed(2),
              price,
              sell_order_id: sellingList.data.items[index].id,
            },
          ]

          await postSellOrderChange({ sell_orders })

          await sendMessage(
            `<a href="https://buff.market/market/goods/${item.goods_id}">${itemsOnSale.data.goods_infos[item.goods_id].market_hash_name}</a> ($${sellingList.data.items[index].price} -> $${price})`
          )
        }
      }

      if (index > 0) {
        const price = (Number(sellingList.data.items[index - 1].price) - 0.01).toFixed(2)
        const currentDiff = Number(
          (+sellingList.data.items[index].price - +sellingList.data.items[index - 1].price).toFixed(2)
        )

        if (currentDiff === 0.01) {
          const goods_ids = `${sellingList.data.items[index].goods_id}`
          const fee = await getMarketBatchFee({ goods_ids, prices: price })

          const sell_orders = [
            {
              desc: '',
              income: (Number(price) - Number(fee.data.total_fee)).toFixed(2),
              price,
              sell_order_id: sellingList.data.items[index].id,
            },
          ]

          await postSellOrderChange({ sell_orders })

          await sendMessage(
            `<a href="https://buff.market/market/goods/${item.goods_id}">${itemsOnSale.data.goods_infos[item.goods_id].market_hash_name}</a> ($${sellingList.data.items[index].price} -> $${price})`
          )
        }
      }

      await sleep(2_000)
    }
  } catch (error) {
    console.log(error)
    await sendMessage('Error fetching items on sale.')

    return
  }
}
