import 'dotenv/config'

import { getGoodsSellOrder } from '../api/buff'
import { sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { getCSFloatListings } from '../api/csfloat'
import { readFileSync } from 'fs'
import path from 'path'
import { format } from 'date-fns'

const CASHED_LISTINGS = new Set<string>()

const pathname = path.join(__dirname, '../../goods_id.json')
const goods_id: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

const cs2Buff = async () => {
  try {
    const response = await getCSFloatListings({
      sort_by: 'most_recent',
      max_float: 0.38,
      category: 1,
      min_price: 500,
      max_price: 2000,
    })

    for (const item of response.data) {
      if (CASHED_LISTINGS.has(item.id)) continue

      if (goods_id[item.item.market_hash_name] && item.reference.predicted_price > item.price) {
        const orders = await getGoodsSellOrder({
          exclude_current_user: 1,
          goods_id: goods_id[item.item.market_hash_name],
        })

        const lowestPricedItem = orders.data.items.find((el) => el.price)

        if (lowestPricedItem) {
          const now = format(new Date(), 'HH:mm:ss')
          const current_price = item.price / 100
          const estimated_profit = ((Number(lowestPricedItem.price) - current_price) / current_price) * 100

          console.log(now, item.item.market_hash_name, estimated_profit.toFixed(2))

          if (estimated_profit >= 15) {
            const message: string[] = []

            message.push(`<a href="https://csfloat.com/item/${item.id}">CSFLOAT</a>`)
            message.push(' | ')
            message.push(
              `<a href="https://buff.market/market/goods/${goods_id[item.item.market_hash_name]}">BUFF</a>\n\n`
            )

            message.push(`<b>CS price</b>: $${current_price.toFixed(2)}\n`)
            message.push(`<b>Buff price</b>: $${lowestPricedItem.price}\n`)
            message.push(`<b>Estimated profit</b>: ${estimated_profit.toFixed(2)}%\n`)

            await sendMessage(message.join(''))
          }
        }

        await sleep(5_000)
      }

      CASHED_LISTINGS.add(item.id)
    }

    await sleep(60_000 * 2)
  } catch (error) {
    console.log('Something went wrong', error)

    return
  }

  cs2Buff()
}

cs2Buff()
