import 'dotenv/config'

import { sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { getBuyOrders } from '../api/csfloat'

export const GOODS_CACHE: Record<string, { price: number }> = {}

const config = [
  {
    referenceId: '795002736566468718',
    market_hash_name: 'Glock-18 | Gold Toof (Minimal Wear)',
  },
  {
    referenceId: '794975731133317153',
    market_hash_name: 'Glock-18 | Gold Toof (Field-Tested)',
  },
]

const csPriceChecker = async () => {
  try {
    for (const { referenceId, market_hash_name } of config) {
      const response = await getBuyOrders({ id: referenceId })

      const current_price = response[0].price

      if (market_hash_name in GOODS_CACHE && current_price !== GOODS_CACHE[market_hash_name].price) {
        const prev_price = Number((GOODS_CACHE[market_hash_name].price / 100).toFixed(2))
        const next_price = Number((current_price / 100).toFixed(2))
        await sendMessage(
          `<a href="https://csfloat.com/item/${referenceId}">${market_hash_name}</a> | $${prev_price} -> $${next_price}`
        )
      }

      GOODS_CACHE[market_hash_name] = { price: current_price }

      await sleep(60_000)
    }
  } catch (error) {
    console.log('Something went wrong', error)

    return
  }

  csPriceChecker()
}

csPriceChecker()
