import 'dotenv/config'

import { getMarketGoods } from '../api/buff'
import { isLessThanThreshold, sleep } from '../utils'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { generateBuffSellingReport } from '../helpers/generateBuffSellingReport'
import { executeBuffToBuffTrade } from '../helpers/executeBuffToBuffTrade'
import { Source } from '../types'
import { BARGAIN_MIN_PRICE } from '../config'

export const GOODS_CACHE: Record<number, { price: number }> = {}

const buff2buff = async () => {
  const pages = Array.from({ length: 20 }, (_, i) => i + 1)

  try {
    for (const page_num of pages) {
      const marketGoods = await getMarketGoods({ page_num, sort_by: 'sell_num.desc' })

      for (const item of marketGoods.data.items) {
        const now = format(new Date(), 'HH:mm:ss')
        const current_price = Number(item.sell_min_price)

        if (item.id in GOODS_CACHE && isLessThanThreshold(GOODS_CACHE[item.id].price, current_price, 0.1)) {
          GOODS_CACHE[item.id].price = current_price

          continue
        }

        if (item.id in GOODS_CACHE) {
          console.log(`${now}: ${item.market_hash_name} $${GOODS_CACHE[item.id].price} -> $${current_price}`)
        }

        if (item.id in GOODS_CACHE && GOODS_CACHE[item.id].price > current_price) {
          await sleep(5_000)
          await executeBuffToBuffTrade(item, { source: Source.BUFF_BUFF })
          if (Number(item.sell_min_price) > BARGAIN_MIN_PRICE + 10) await generateBuffSellingReport()
        }

        GOODS_CACHE[item.id] = { price: current_price }
      }

      await sleep(3_000)
    }
  } catch (error) {
    console.log('Something went wrong', error)

    await sendMessage(error?.message ?? 'Something went wrong.')

    return
  }

  buff2buff()
}

buff2buff()
