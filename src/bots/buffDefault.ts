import 'dotenv/config'

import { getGoodsInfo, getMarketGoods, getMarketGoodsBillOrder } from '../api/buff'
import { isLessThanThreshold, median, sleep } from '../utils'
import { differenceInDays, format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { Source } from '../types'
import { BLACKLISTED_CATEGORY, BLACKLISTED_ITEMSET, GOODS_SALES_THRESHOLD } from '../config'
import { executeBuffToBuffTrade } from '../helpers/executeBuffToBuffTrade'
import { executeFastBuffTrade } from '../helpers/executeFastBuffTrade'

export const GOODS_THRESHOLD: Record<number, { price: number }> = {}
export const GOODS_CACHE: Record<number, { price: number }> = {}
export const GOODS_BLACKLIST_CACHE: number[] = []

const buffDefault = async () => {
  try {
    const marketGoods = await getMarketGoods({ min_price: 5, max_price: 50 })

    for (const item of marketGoods.data.items) {
      const now = format(new Date(), 'HH:mm:ss')
      const current_price = Number(item.sell_min_price)

      if (GOODS_BLACKLIST_CACHE.includes(item.id)) {
        continue
      }

      if (item.id in GOODS_CACHE && isLessThanThreshold(GOODS_CACHE[item.id].price, current_price, 0.5)) {
        GOODS_CACHE[item.id].price = current_price

        continue
      }

      if (item.id in GOODS_CACHE) {
        console.log(`${now}: ${item.market_hash_name} $${GOODS_CACHE[item.id].price} -> $${current_price}`)
      }

      if (item.id in GOODS_CACHE && GOODS_CACHE[item.id].price > current_price) {
        if (item.id in GOODS_THRESHOLD && GOODS_THRESHOLD[item.id].price > current_price) {
          executeFastBuffTrade(item, { source: Source.BUFF_FAST })
        } else {
          executeBuffToBuffTrade(item, { source: Source.BUFF_DEFAULT })
        }
      }

      GOODS_CACHE[item.id] = { price: current_price }
    }

    await sleep(2_500)
  } catch (error) {
    console.log('Something went wrong', error)

    if (error.message !== 'Request failed with status code 503') {
      await sendMessage(error?.message ?? 'Something went wrong.')

      return
    }

    await sendMessage(`${error.message}. Restarting in 60 seconds...`)
    await sleep(60_000)
  }

  buffDefault()
}

;(async () => {
  const pages = Array.from({ length: 50 }, (_, i) => i + 1)

  for (const page_num of pages) {
    const goods = await getMarketGoods({ page_num, min_price: 5, max_price: 50 })
    for (const item of goods.data.items) GOODS_CACHE[item.id] = { price: Number(item.sell_min_price) }
    if (goods.data.items.length !== 50) break
    await sleep(5_000)
  }

  for (const page_num of pages) {
    const goods = await getMarketGoods({ itemset: BLACKLISTED_ITEMSET.join(','), page_num })
    goods.data.items.forEach((item) => GOODS_BLACKLIST_CACHE.push(item.id))
    if (goods.data.items.length !== 50) break
    await sleep(5_000)
  }

  for (const page_num of pages) {
    const goods = await getMarketGoods({ category: BLACKLISTED_CATEGORY.join(','), page_num })
    goods.data.items.forEach((item) => GOODS_BLACKLIST_CACHE.push(item.id))
    if (goods.data.items.length !== 50) break
    await sleep(5_000)
  }

  for (const page_num of pages) {
    const goods = await getMarketGoods({
      page_num,
      min_price: 5,
      max_price: 50,
      category_group: 'rifle,pistol,smg,shotgun',
      category: 'csgo_type_musickit',
    })

    for (const item of goods.data.items) {
      const goods_id = item.id
      const current_price = Number(item.sell_min_price)
      if (item.sell_num < 10) continue
      const history = await getMarketGoodsBillOrder({ goods_id })
      const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
        return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
      })
      await sleep(3_000)

      if (salesLastWeek.length > GOODS_SALES_THRESHOLD) {
        const sales = salesLastWeek.map(({ price }) => Number(price))
        const median_price = median(sales.filter((price) => current_price * 2 > price))
        const goodsInfo = await getGoodsInfo({ goods_id })
        const reference_price = Number(goodsInfo.data.goods_info.goods_ref_price)
        GOODS_THRESHOLD[item.id] = { price: Number((Math.min(median_price, reference_price) * 0.875).toFixed(2)) }
        await sleep(3_000)
      }
    }

    console.log(
      format(new Date(), 'HH:mm:ss'),
      `page: ${page_num}, collected ${Object.keys(GOODS_THRESHOLD).length} items.`
    )

    if (goods.data.items.length !== 50) break
    await sleep(5_000)
  }

  buffDefault()
})()
