import dotenv from 'dotenv'

dotenv.config()

import { getMarketGoods } from '../api/buff'
import { isLessThanThreshold, sleep } from '../utils'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { Source } from '../types'
import { executeBuffToCSFloatTrade } from '../helpers/executeBuffToCSFloatTrade'

export const GOODS_CACHE: Record<number, { price: number }> = {}
export const GOODS_BLACKLIST_CACHE: number[] = [30431, 30235, 30259, 30269, 30350]

const microBuffSteam = async () => {
  const pages = Array.from({ length: 50 }, (_, i) => i + 1)

  do {
    for (const page_num of pages) {
      try {
        const marketGoods = await getMarketGoods({
          page_num,
          min_price: Number(process.env.MIN_BARGAIN_PRICE),
          max_price: Number(process.env.MAX_BARGAIN_PRICE),
          category_group: 'rifle,pistol,smg',
        })

        for (const item of marketGoods.data.items) {
          const now = format(new Date(), 'HH:mm:ss')
          const current_price = Number(item.sell_min_price)

          if (GOODS_BLACKLIST_CACHE.includes(item.id) || item.is_charm) {
            continue
          }

          if (item.id in GOODS_CACHE && isLessThanThreshold(GOODS_CACHE[item.id].price, current_price, 0.01)) {
            GOODS_CACHE[item.id].price = current_price

            continue
          }

          if (item.id in GOODS_CACHE) {
            console.log(`${now}: ${item.market_hash_name} $${GOODS_CACHE[item.id].price} -> $${current_price}`)
          }

          if (item.id in GOODS_CACHE && GOODS_CACHE[item.id].price > current_price) {
            executeBuffToCSFloatTrade(item, { source: Source.BUFF_CSFLOAT })
          }

          GOODS_CACHE[item.id] = { price: current_price }
        }

        if (marketGoods.data.items.length !== 50) {
          break
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
    }

    // eslint-disable-next-line no-constant-condition
  } while (true)
}

microBuffSteam()
