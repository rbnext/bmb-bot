import 'dotenv/config'

import { isLessThanThreshold, sleep } from '../utils'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { PROXY_AGENTS, getPublicMarketGoods } from '../api/public'

export const GOODS_CACHE: Record<number, { price: number }> = {}
export const GOODS_BLACKLIST_CACHE: number[] = []

const proxyCheck = async () => {
  const proxy_list = Array.from({ length: PROXY_AGENTS.length }, (_, i) => i)

  try {
    for (const proxy_index of proxy_list) {
      const marketGoods = await getPublicMarketGoods({ proxy_index, min_price: 1, max_price: 40 })

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

        GOODS_CACHE[item.id] = { price: current_price }
      }

      await sleep(3_000)
    }
  } catch (error) {
    console.log('Something went wrong', error)

    if (error.message !== 'Request failed with status code 503' || error.message !== '') {
      await sendMessage(error?.message ?? 'Something went wrong.')

      return
    }

    await sendMessage(`${error.message}. Restarting in 60 seconds...`)
    await sleep(60_000)
  }

  proxyCheck()
}

proxyCheck()
