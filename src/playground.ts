import 'dotenv/config'
import { getGoodsInfo, getMarketGoods, getMarketGoodsBillOrder } from './api/buff'
import { median, sleep } from './utils'
import { differenceInDays } from 'date-fns'
import { GOODS_SALES_THRESHOLD } from './config'

export const GOODS_THRESHOLD: Record<number, { price: number }> = {}

const init = async () => {
  const pages = Array.from({ length: 50 }, (_, i) => i + 1)

  for (const page_num of pages) {
    const goods = await getMarketGoods({
      page_num,
      min_price: 5,
      max_price: 50,
      category_group: 'rifle,pistol,smg,shotgun',
      category: 'csgo_type_musickit',
    })
    await sleep(3_000)

    for (const item of goods.data.items) {
      const goods_id = item.id
      const current_price = Number(item.sell_min_price)

      if (item.sell_num < 10) {
        continue
      }

      const history = await getMarketGoodsBillOrder({ goods_id })
      await sleep(3_000)

      const salesLastWeek = history.data.items.filter(
        ({ updated_at, type }) => differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
      )

      if (salesLastWeek.length > GOODS_SALES_THRESHOLD) {
        const sales = salesLastWeek.map(({ price }) => Number(price))
        const median_price = median(sales.filter((price) => current_price * 2 > price))

        const goodsInfo = await getGoodsInfo({ goods_id })
        const reference_price = Number(goodsInfo.data.goods_info.goods_ref_price)
        await sleep(3_000)

        const min_price = Math.min(median_price, reference_price)

        console.log(item.market_hash_name, current_price, Number((min_price * 0.875).toFixed(2)))

        GOODS_THRESHOLD[item.id] = { price: Number((min_price * 0.875).toFixed(2)) }
      }
    }
  }
}

init()
