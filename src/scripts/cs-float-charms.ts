import 'dotenv/config'

import { sleep } from '../utils'
import { getCSFloatListings } from '../api/csfloat'
import { sendMessage } from '../api/telegram'

const CASHED_LISTINGS = new Set<string>()

const csFloatCharms = async () => {
  const response = await getCSFloatListings({ keychains: '[{"i":18}]' })

  for (const data of response.data) {
    if (CASHED_LISTINGS.has(data.id)) continue

    const keychains = data.item.keychains ?? []
    const currentPrice = Number((data.price / 100).toFixed(2))
    const basePrice = Number((data.reference.base_price / 100).toFixed(2))
    const keychainTotal = keychains.reduce((acc, cur) => acc + cur.reference.price, 0) / 100

    console.log(data.item.market_hash_name)
    for (const keychain of keychains) console.log(`|___ ${keychain.name}: ${keychain.pattern}`)

    if (basePrice + keychainTotal > currentPrice) {
      const message: string[] = []

      message.push(`<a href="https://csfloat.com/item/${data.id}">${data.item.market_hash_name}</a>\n\n`)

      for (const keychain of keychains) {
        message.push(`<b>${keychain.name}</b>: ${keychain.pattern}\n`)
      }

      message.push(`\n`)
      message.push(`<b>Price</b>: $${currentPrice}\n`)
      message.push(`<b>Base price</b>: $${basePrice.toFixed(2)}\n`)
      message.push(`<b>Keychains total</b>: $${keychainTotal.toFixed(2)}\n\n`)

      await sendMessage(message.join(''))
    }

    CASHED_LISTINGS.add(data.id)
  }

  await sleep(30_000)
  csFloatCharms()
}

csFloatCharms()
