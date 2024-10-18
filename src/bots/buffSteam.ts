import 'dotenv/config'

import { getMarketGoods } from '../api/buff'
import { isLessThanThreshold, sleep } from '../utils'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { Source } from '../types'
import { executeBuffToSteamTrade } from '../helpers/executeBuffToSteamTrade'

export const GOODS_CACHE: Record<number, { price: number }> = {}

const buffSteam = async () => {
  try {
    const marketGoods = await getMarketGoods({ min_price: 2, max_price: 100 })

    for (const item of marketGoods.data.items) {
      const now = format(new Date(), 'HH:mm:ss')
      const current_price = Number(item.sell_min_price)

      if (
        item.goods_info.info.tags.type.internal_name === 'csgo_tool_keychain' ||
        item.goods_info.info.tags.type.internal_name === 'type_customplayer' ||
        item.goods_info.info.tags.type.internal_name === 'csgo_tool_sticker'
      ) {
        GOODS_CACHE[item.id].price = current_price

        continue
      }

      if (item.id in GOODS_CACHE && isLessThanThreshold(GOODS_CACHE[item.id].price, current_price, 0.1)) {
        GOODS_CACHE[item.id].price = current_price

        continue
      }

      if (item.id in GOODS_CACHE) {
        console.log(`${now}: ${item.market_hash_name} $${GOODS_CACHE[item.id].price} -> $${current_price}`)
      }

      if (item.id in GOODS_CACHE && GOODS_CACHE[item.id].price > current_price) {
        await executeBuffToSteamTrade(item, { source: Source.BUFF_STEAM })
      }

      GOODS_CACHE[item.id] = { price: current_price }
    }

    await sleep(3_000)
  } catch (error) {
    console.log('Something went wrong', error)

    if (error.message !== 'Request failed with status code 503') {
      await sendMessage(error?.message ?? 'Something went wrong.')

      return
    }

    await sendMessage(`${error.message}. Restarting in 60 seconds...`)
    await sleep(60_000)
  }

  buffSteam()
}

;(async () => {
  const pages = Array.from({ length: 50 }, (_, i) => i + 1)

  for (const page_num of pages) {
    const goods = await getMarketGoods({ page_num, min_price: 2, max_price: 50 })

    for (const item of goods.data.items) {
      GOODS_CACHE[item.id] = { price: Number(item.sell_min_price) }
    }

    await sleep(10_000)
  }

  buffSteam()
})()
