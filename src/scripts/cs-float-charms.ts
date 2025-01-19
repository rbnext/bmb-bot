import 'dotenv/config'

import { sleep } from '../utils'
import { getCSFloatListings } from '../api/csfloat'
import { sendMessage } from '../api/telegram'
import { format } from 'date-fns'

const CASHED_LISTINGS = new Set<string>()

const getPredictedPrice = (pattern: number, base: number) => {
  if (pattern >= 1 && pattern <= 5000) return 15
  if (pattern > 5000 && pattern <= 9000) return 10
  if (pattern >= 20000 && pattern <= 23000) return 17
  if (pattern > 23000 && pattern <= 25000) return 10
  if (pattern >= 90000 && pattern <= 94999) return 8
  if (pattern >= 95000 && pattern <= 98999) return 12
  if (pattern >= 99000 && pattern <= 99999) return 20

  return base
}

const csFloatCharms = async () => {
  const response = await getCSFloatListings({ keychains: '[{"i":18}]' })

  for (const data of response.data) {
    if (CASHED_LISTINGS.has(data.id)) continue

    const keychains = data.item.keychains ?? []
    const currentPrice = Number((data.price / 100).toFixed(2))
    const predictedPrice = Number((data.reference.predicted_price / 100).toFixed(2))
    const keychain = keychains.find((k) => k.name === 'Charm | Die-cast AK')

    if (keychain) {
      const now = format(new Date(), 'HH:mm:ss')
      const keychainPrice = getPredictedPrice(keychain.pattern, keychain.reference.price / 100)
      const profit = predictedPrice + keychainPrice - 0.33 - currentPrice

      console.log(now, data.item.market_hash_name, profit.toFixed(2))

      if (profit > 0) {
        const message: string[] = []

        message.push(`<a href="https://csfloat.com/item/${data.id}">${data.item.market_hash_name}</a>\n\n`)

        for (const keychain of keychains) {
          message.push(`<b>${keychain.name}</b>: ${keychain.pattern}\n`)
        }

        message.push(`\n`)
        message.push(`<b>Price</b>: $${currentPrice}\n`)
        message.push(`<b>Predicted price</b>: $${predictedPrice.toFixed(2)}\n`)
        message.push(`<b>Profit</b>: ~$${profit.toFixed(2)}\n\n`)

        await sendMessage(message.join(''))
      }
    }

    CASHED_LISTINGS.add(data.id)
  }

  await sleep(30_000)
  csFloatCharms()
}

csFloatCharms()
