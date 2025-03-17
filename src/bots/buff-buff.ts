import dotenv from 'dotenv'

dotenv.config()

import { getMarketGoods } from '../api/buff'
import { isLessThanThreshold, sleep } from '../utils'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { Source } from '../types'
import { executeBuffToBuffTrade } from '../helpers/executeBuffToBuffTrade'

export const GOODS_CACHE: Record<number, { price: number }> = {}
export const GOODS_BLACKLIST_CACHE: number[] = [30431, 30235, 30259, 30269, 30350]

const buffSteam = async () => {
  const pages = Array.from({ length: 15 }, (_, i) => i + 1)

  for (const page_num of pages) {
    try {
      const marketGoods = await getMarketGoods({
        min_price: Number(process.env.MIN_BARGAIN_PRICE),
        max_price: Number(process.env.MAX_BARGAIN_PRICE),
        page_num,
      })

      for (const item of marketGoods.data.items) {
        const current_price = Number(item.sell_min_price)

        if (GOODS_BLACKLIST_CACHE.includes(item.id) || item.is_charm) {
          continue
        }

        if (item.id in GOODS_CACHE && isLessThanThreshold(GOODS_CACHE[item.id].price, current_price, 0.1)) {
          GOODS_CACHE[item.id].price = current_price

          continue
        }

        if (item.id in GOODS_CACHE && GOODS_CACHE[item.id].price > current_price) {
          executeBuffToBuffTrade(item, { source: Source.BUFF_BUFF, csFloatEnabled: true })
        }

        GOODS_CACHE[item.id] = { price: current_price }
      }

      await sleep(2_500)
    } catch (error) {
      console.log('Something went wrong', error)

      if (error.message !== 'Request failed with status code 503') {
        await sendMessage({ text: error?.message ?? 'Something went wrong.' })

        return
      }

      await sendMessage({ text: `${error.message}. Restarting in 60 seconds...` })
      await sleep(60_000)
    }
  }

  buffSteam()
}

;(async () => {
  const pages = Array.from({ length: 50 }, (_, i) => i + 1)

  for (const page_num of pages) {
    const goods = await getMarketGoods({
      page_num,
      min_price: Number(process.env.MIN_BARGAIN_PRICE),
      max_price: Number(process.env.MAX_BARGAIN_PRICE),
    })
    for (const item of goods.data.items) GOODS_CACHE[item.id] = { price: Number(item.sell_min_price) }
    if (goods.data.items.length !== 50) break
    await sleep(5_000)
  }

  console.log('Loaded items: ', Object.keys(GOODS_CACHE).length)
  console.log('Disabled items: ', Object.keys(GOODS_BLACKLIST_CACHE).length)

  buffSteam()
})()
