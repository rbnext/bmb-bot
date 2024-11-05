import 'dotenv/config'
import { getSentBargain, getShopBillOrder } from './api/buff'
import { sleep } from './utils'

export const GOODS_THRESHOLD: Record<number, { price: number }> = {}

const init = async () => {
  const pages = Array.from({ length: 2 }, (_, i) => i + 2)
  for (const page_num of pages) {
    const bargains = await getSentBargain({ page_num })

    for (const bargain of bargains.data.items) {
      const response = await getShopBillOrder({ user_id: bargain.seller_id })

      if (bargain.asset_info.paintwear) {
        const market_hash_name = bargains.data.goods_infos[bargain.goods_id].market_hash_name
        const item = response.data.items.find((el) => el.asset_info.paintwear === bargain.asset_info.paintwear)

        if (item) {
          console.log(market_hash_name, `${bargain.price}/${item.original_price} ->`, item.price)
        }
      }

      await sleep(5_000)
    }
    await sleep(5_000)
  }
}

init()
