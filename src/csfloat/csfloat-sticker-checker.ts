import 'dotenv/config'

import schedule from 'node-schedule'
import { sendMessage, sendPhoto } from '../api/telegram'
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
    filter: 'sticker_combos',
    min_price: 50,
    max_price: 5000,
    max_float: 0.6,
  })

  for (const data of response.data) {
    if (CASHED_LISTINGS.has(data.id) || data.item.is_souvenir) continue

    const price = data.price
    const market_hash_name = data.item.market_hash_name

    const stickers = data.item.stickers || []
    const stickerTotal = stickers.reduce((acc, { reference, wear }) => {
      return acc + typeof wear === 'number' ? 0 : reference?.price || 0
    }, 0)

    const now = format(new Date(), 'HH:mm:ss')
    const SP = getStickerPercentage(data, price)

    if (stickerTotal >= 500) {
      console.log(`${now} ${market_hash_name} SP -> ${SP.toFixed(1)}%; ST -> $${(stickerTotal / 100).toFixed(1)}`)
    }

    if (stickerTotal > 1000 && SP < 10) {
      const message: string[] = []
      message.push(`🤝 <b>[STICKER CHECKER]</b>` + ' ')
      message.push(`<a href="https://csfloat.com/item/${data.id}">${market_hash_name}</a> ${SP.toFixed(1)}% SP\n\n`)

      for (const sticker of stickers) {
        message.push(`<b>${sticker.name}</b>: $${((sticker.reference?.price ?? 0) / 100).toFixed(2)}\n`)
      }

      const response = await sendMessage({
        text: message.join(''),
        chat_id: process.env.TELEGRAM_CSFLOAT_CHAT_ID,
      })

      if (data.item.cs2_screenshot_id) {
        await sendPhoto({
          chat_id: process.env.TELEGRAM_CSFLOAT_CHAT_ID,
          photo: `https://s.csfloat.com/m/${data.item.cs2_screenshot_id}/playside.png?v=3`,
          reply_to_message_id: response.result.message_id,
        })
      }
    }

    CASHED_LISTINGS.add(data.id)
  }
}

schedule.scheduleJob(`${process.env.SPEC} * * * * *`, async () => {
  handler().catch((error) => {
    const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message : error.message

    sendMessage({ text: `Sticker checker error: ${errorMessage}` }).then(() => {
      process.exit(1)
    })
  })
})
