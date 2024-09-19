import { getGoodsSellOrder, getItemsOnSale } from '../api/buff'
import { sendMessage } from '../api/telegram'
import { sleep } from '../utils'

export const generateBuffSellingReport = async () => {
  try {
    const itemsOnSale = await getItemsOnSale({})

    const messages: string[] = []

    for (const item of itemsOnSale.data.items) {
      const sellingList = await getGoodsSellOrder({ goods_id: item.goods_id })

      const index = sellingList.data.items.findIndex((el) => el.user_id === 'U1092757843')

      if (index > 0) {
        const diff = Number(sellingList.data.items[index].price) - Number(sellingList.data.items[0].price)

        messages.push(
          `<a href="https://buff.market/market/goods/${item.goods_id}">${itemsOnSale.data.goods_infos[item.goods_id].market_hash_name}</a> ($${diff.toFixed(2)})`
        )
      }

      await sleep(2_000)
    }

    await sendMessage(messages.join('\n'))
  } catch (error) {
    console.log(error)
    await sendMessage('Error fetching items on sale.')

    return
  }
}
