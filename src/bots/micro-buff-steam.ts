import dotenv from 'dotenv'

dotenv.config()

import { getMarketGoods } from '../api/buff'
import { isLessThanThreshold, sleep } from '../utils'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { Source } from '../types'
import { executeBuffToMicroSteamTrade } from '../helpers/executeBuffToMicroSteamTrade'

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
          category_group: 'rifle,pistol,smg,shotgun,machinegun,other',
        })

        for (const item of marketGoods.data.items) {
          const now = format(new Date(), 'HH:mm:ss')
          const currentPrice = Number(item.sell_min_price)
          const steamPrice = Number(item.goods_info.steam_price)
          const profitPercentage = ((steamPrice - currentPrice) / currentPrice) * 100

          if (GOODS_BLACKLIST_CACHE.includes(item.id) || item.is_charm) {
            continue
          }

          if (item.id in GOODS_CACHE && isLessThanThreshold(GOODS_CACHE[item.id].price, currentPrice, 0.01)) {
            GOODS_CACHE[item.id].price = currentPrice

            continue
          }

          if (item.id in GOODS_CACHE) {
            console.log(`${now}: ${item.market_hash_name} $${GOODS_CACHE[item.id].price} -> $${currentPrice}`)
          }

          if (item.id in GOODS_CACHE && GOODS_CACHE[item.id].price > currentPrice && profitPercentage > 50) {
            executeBuffToMicroSteamTrade(item, { source: Source.BUFF_STEAM })
          }

          GOODS_CACHE[item.id] = { price: currentPrice }
        }

        if (marketGoods.data.items.length !== 50) {
          console.log(page_num)
          break
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

    // eslint-disable-next-line no-constant-condition
  } while (true)
}

microBuffSteam()
