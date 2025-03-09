import 'dotenv/config'

import schedule from 'node-schedule'
import { sendMessage } from '../api/telegram'
import { format } from 'date-fns'
import { getCSFloatListings } from '../api/csfloat'
import axios from 'axios'
import { CSFloatListingItem } from '../types'

const CASHED_LISTINGS = new Set<string>()

const getStickerPercentage = (item: CSFloatListingItem, price: number) => {
  const stickers = item.item.stickers || []
  const predictedPrice = item.reference.predicted_price
  const stickerTotal = stickers.reduce((acc, { reference }) => acc + (reference?.price || 0), 0)

  return price >= predictedPrice && stickerTotal != 0 ? ((price - predictedPrice) / stickerTotal) * 100 : 0
}

const handler = async () => {
  const response = await getCSFloatListings({
    sort_by: 'most_recent',
    min_price: 50,
    max_price: 1000,
    max_float: 0.6,
  })

  for (const data of response.data) {
    if (CASHED_LISTINGS.has(data.id) || data.item.is_souvenir) continue

    const price = data.price
    const predictedPrice = data.reference.predicted_price
    const market_hash_name = data.item.market_hash_name

    const stickers = data.item.stickers || []
    const stickerTotal = stickers.reduce((acc, { reference, wear }) => {
      return acc + typeof wear === 'number' ? 0 : reference?.price || 0
    }, 0)

    const SP = getStickerPercentage(data, price)

    const overpayment = Number((((price - predictedPrice) / predictedPrice) * 100).toFixed(2))

    const now = format(new Date(), 'HH:mm:ss')

    if (stickerTotal >= 100 && overpayment < 5) {
      console.log(`${now} ${market_hash_name} OVP -> ${overpayment.toFixed(1)}%; SP -> ${SP.toFixed(1)}%`)
    }

    if (stickerTotal > 1000 && SP < 5 && overpayment < 3) {
      const message: string[] = []
      message.push(`🤝 <b>[STICKER CHECKER]</b>` + ' ')
      message.push(`<a href="https://csfloat.com/item/${data.id}">${market_hash_name}</a>\n\n`)

      for (const sticker of stickers) {
        message.push(`<b>${sticker.name}</b>: $${((sticker.reference?.price ?? 0) / 100).toFixed(2)}\n`)
      }

      await sendMessage(message.join(''), undefined, process.env.TELEGRAM_CSFLOAT_CHAT_ID)
    }

    CASHED_LISTINGS.add(data.id)
  }
}

schedule.scheduleJob(`${process.env.SPEC} * * * * *`, async () => {
  handler().catch((error) => {
    const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message : error.message

    sendMessage(`Sticker checker error: ${errorMessage}`).then(() => {
      process.exit(1)
    })
  })
})
