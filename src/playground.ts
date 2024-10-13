import 'dotenv/config'

import { getShopBillOrder } from './api/buff'
import { getBargainDiscountPrice, median } from './utils'

const playground = async (user_id: string) => {
  const userSellingHistory = await getShopBillOrder({ user_id })

  if (userSellingHistory.code !== 'OK') {
    return
  }

  const median_percent = median(
    userSellingHistory.data.items
      .filter((item) => item.has_bargain)
      .map((item) => (Number(item.original_price) / Number(item.price) - 1) * 100)
  )

  for (const item of userSellingHistory.data.items) {
    if (item.has_bargain) {
      console.log(
        item.goods_id,
        item.original_price,
        median_percent,
        '---',
        (Number(item.original_price) / Number(item.price) - 1) * 100,
        '---',
        item.price,
        ' -> ',
        getBargainDiscountPrice(Number(item.original_price), userSellingHistory.data.items)
      )
    }
  }
}

playground('U1094452797')
