import { format } from 'date-fns'
import { getGoodsSellOrder, getItemsOnSale } from '../api/buff'
import { CURRENT_USER_ID } from '../config'
import { sleep } from '../utils'
import { executePriceChange } from './executePriceChange'

export const generateBuffSellingReport = async () => {
  console.log(`${format(new Date(), 'HH:mm:ss')}: Generating selling report started.`)

  const itemsOnSale = await getItemsOnSale({})

  for (const item of itemsOnSale.data.items) {
    await sleep(4_000)

    const sellingList = await getGoodsSellOrder({ goods_id: item.goods_id })

    const current_price = Number(item.price)

    const index = sellingList.data.items.findIndex((el) => el.user_id === CURRENT_USER_ID)
    const market_hash_name = itemsOnSale.data.goods_infos[item.goods_id].market_hash_name

    const payload = {
      market_hash_name,
      prev_price: current_price,
      sell_order_id: item.id,
      goods_id: item.goods_id,
      assetid: item.asset_info.assetid,
      classid: item.asset_info.classid,
    }

    if (index === 0) {
      const price = (Number(sellingList.data.items[1].price) - 0.01).toFixed(2)
      const currentDiff = Number((+sellingList.data.items[1].price - current_price).toFixed(2))

      if (currentDiff > 0.01) await executePriceChange({ price, ...payload })
    }

    if (index > 0) {
      const price = (Number(sellingList.data.items[index - 1].price) - 0.01).toFixed(2)
      const currentDiff = Number((current_price - +sellingList.data.items[index - 1].price).toFixed(2))

      if (currentDiff === 0.01) await executePriceChange({ price, ...payload })
    }
  }

  console.log(`${format(new Date(), 'HH:mm:ss')}: Generating selling report complied.`)
}
