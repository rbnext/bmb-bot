import 'dotenv/config'

import { sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { getBuyOrders, getCSFloatListings } from '../api/csfloat'
import path from 'path'
import { readFileSync } from 'fs'

const GOODS_CACHE: Record<string, { price: number }> = {}

const pathname = path.join(__dirname, '../../csfloat.txt')
const content: string = readFileSync(pathname, 'utf-8')
const market_hash_names: string[] = content.split('\n').filter((name) => !!name.trim())
const config = market_hash_names.map((name) => ({ market_hash_name: name.trim(), referenceId: '' }))

console.log(process.env.TELEGRAM_CSFLOAT_ORDERS_ID)

const csPriceChecker = async () => {
  try {
    for (const data of config) {
      const market_hash_name = data.market_hash_name

      if (!data.referenceId) {
        await getCSFloatListings({ market_hash_name }).then((response) => {
          data.referenceId = response.data[0].id
        })
      } else {
        const response = await getBuyOrders({ id: data.referenceId })

        const current_price = response[0].price

        if (market_hash_name in GOODS_CACHE && current_price !== GOODS_CACHE[market_hash_name].price) {
          const prev_price = Number((GOODS_CACHE[market_hash_name].price / 100).toFixed(2))
          const next_price = Number((current_price / 100).toFixed(2))
          await sendMessage({
            text: `<a href="https://csfloat.com/item/${data.referenceId}">${market_hash_name}</a> | $${prev_price} -> $${next_price}`,
            chat_id: process.env.TELEGRAM_CSFLOAT_ORDERS_ID,
          })
        }

        GOODS_CACHE[data.market_hash_name] = { price: current_price }
      }

      await sleep(10_000)
    }
  } catch (error) {
    console.log('Something went wrong', error)

    return
  }

  csPriceChecker()
}

csPriceChecker()
