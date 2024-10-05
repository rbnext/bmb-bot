import 'dotenv/config'

import { getMarketGoods } from '../api/buff'
import { isLessThanThreshold, sleep } from '../utils'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { generateBuffSellingReport } from '../helpers/generateBuffSellingReport'
import { executeBuffToBuffTrade } from '../helpers/executeBuffToBuffTrade'
import { Source } from '../types'

export const GOODS_CACHE: Record<number, { price: number }> = {}

const buff2buff = async () => {
  let currentPage = 1
  const pagesToLoad = 13
  let hasNextPage = true

  try {
    do {
      const page_num = currentPage
      const marketGoods = await getMarketGoods({ page_num, sort_by: 'sell_num.desc' })

      const now = format(new Date(), 'HH:mm:ss')

      if (hasNextPage) {
        hasNextPage = currentPage < pagesToLoad
      }

      for (const item of marketGoods.data.items) {
        const goods_id = item.id
        const current_price = Number(item.sell_min_price)

        if (goods_id in GOODS_CACHE && isLessThanThreshold(GOODS_CACHE[goods_id].price, current_price, 0.1)) {
          GOODS_CACHE[goods_id].price = current_price

          continue
        }

        if (goods_id in GOODS_CACHE) {
          console.log(`${now}: ${item.market_hash_name} $${GOODS_CACHE[goods_id].price} -> $${current_price}`)

          if (GOODS_CACHE[goods_id].price > current_price) {
            await executeBuffToBuffTrade(item, { source: Source.BUFF_BUFF })
            await generateBuffSellingReport()
          }
        }

        GOODS_CACHE[goods_id] = { price: current_price }

        await sleep(1_000)
      }

      if (hasNextPage) {
        await sleep(4_000)
      }

      currentPage += 1
    } while (hasNextPage)
  } catch (error) {
    console.log('Something went wrong', error)

    await sendMessage(error?.message ?? 'Something went wrong.')

    return
  }

  buff2buff()
}

buff2buff()
