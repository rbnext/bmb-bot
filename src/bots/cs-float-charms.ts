import 'dotenv/config'

import { sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { getCSFloatListings } from '../api/csfloat'

const GOODS_CACHE = new Set<string>()

const csFloatCharms = async () => {
  try {
    const response = await getCSFloatListings({
      min_price: 1000,
      max_price: 5000,
      sort_by: 'most_recent',
    })

    for (const data of response.data) {
      if (!GOODS_CACHE.has(data.id) && data.item?.keychains) {
        const keychainsTotal = data.item.keychains.reduce((acc, cur) => acc + cur.reference.price, 0) / 100

        if (keychainsTotal > 3) {
          const message: string[] = []

          message.push(`<a href="https://csfloat.com/item/${data.id}">${data.item.market_hash_name}</a>\n\n`)

          for (const keychain of data.item.keychains) {
            message.push(
              `<b>${keychain.name} (#${keychain.pattern})</b>: $${(keychain.reference.price / 100).toFixed(2)}\n`
            )
          }

          message.push(`\n`)
          message.push(`<b>Price</b>: $${(data.price / 100).toFixed(2)}\n`)
          message.push(`<b>Base price</b>: $${(data.reference.base_price / 100).toFixed(2)}\n`)
          message.push(`<b>Predicted price</b>: $${(data.reference.predicted_price / 100).toFixed(2)}\n`)

          await sendMessage(message.join(''))
        } else {
          console.log(data.item.market_hash_name, keychainsTotal.toFixed(2))
        }
      }

      GOODS_CACHE.add(data.id)
    }
  } catch (error) {
    console.log('Something went wrong', error)

    return
  }

  await sleep(40_000)
  csFloatCharms()
}

csFloatCharms()
