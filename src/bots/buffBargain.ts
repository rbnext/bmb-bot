import 'dotenv/config'

import { getMarketGoods } from '../api/buff'
import { isLessThanThreshold, sleep } from '../utils'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { Source } from '../types'
import { BARGAIN_MIN_PRICE, BLACKLISTED_CATEGORY, BLACKLISTED_ITEMSET } from '../config'
import { executeBuffBargainTrade } from '../helpers/executeBuffBargainTrade'
import { executeBuffToBuffTrade } from '../helpers/executeBuffToBuffTrade'

export const GOODS_CACHE: Record<number, { price: number }> = {}
export const GOODS_BLACKLIST_CACHE: number[] = []

const buffBargain = async () => {
  try {
    const marketGoods = await getMarketGoods({ min_price: 5, max_price: 100 })

    for (const item of marketGoods.data.items) {
      const now = format(new Date(), 'HH:mm:ss')
      const current_price = Number(item.sell_min_price)

      if (GOODS_BLACKLIST_CACHE.includes(item.id)) {
        continue
      }

      if (item.id in GOODS_CACHE && isLessThanThreshold(GOODS_CACHE[item.id].price, current_price, 0.25)) {
        GOODS_CACHE[item.id].price = current_price

        continue
      }

      if (item.id in GOODS_CACHE) {
        console.log(`${now}: ${item.market_hash_name} $${GOODS_CACHE[item.id].price} -> $${current_price}`)
      }

      if (item.id in GOODS_CACHE && GOODS_CACHE[item.id].price > current_price) {
        const executeTrade = current_price >= BARGAIN_MIN_PRICE ? executeBuffBargainTrade : executeBuffToBuffTrade

        await executeTrade(item, { source: Source.BUFF_DEFAULT })
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

  buffBargain()
}

;(async () => {
  const pages = Array.from({ length: 50 }, (_, i) => i + 1)

  for (const page_num of pages) {
    const goods = await getMarketGoods({ page_num, min_price: 5, max_price: 100 })
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

  buffBargain()
})()
