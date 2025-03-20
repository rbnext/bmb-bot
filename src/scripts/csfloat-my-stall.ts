import 'dotenv/config'

import { sendMessage } from '../api/telegram'
import { createListing, deleteListing, getMySellingList } from '../api/csfloat'
import { isMoreThanXHours, sleep } from '../utils'
import { format } from 'date-fns'

const init = async () => {
  const listings = await getMySellingList({})

  for (const item of listings.data) {
    const now = format(new Date(), 'HH:mm:ss')

    const stickers = item.item.stickers || []
    const stickerTotal = stickers.reduce((acc, { reference }) => acc + (reference?.price || 0) / 100, 0)
    const floatValue = item.item.float_value

    console.log(`[${now}] Processing: ${item.item.market_hash_name}`)

    if (isMoreThanXHours(item.created_at, 25)) {
      console.log(`├ Listing is older than 24 hours. Deleting and relisting...`)

      await deleteListing({ id: item.id }).then(() => sleep(60_000))
      await createListing({ asset_id: item.item.asset_id, price: item.price - 5 }).then(() => sleep(60_000))

      console.log(`└ Listing has been relisted with a price of ${item.price - 5}`)

      await sendMessage({
        text: `Listing ${item.item.market_hash_name} has been relisted with a new price of $${((item.price - 5) / 100).toFixed(2)}`,
        chat_id: process.env.TELEGRAM_CSFLOAT_CHAT_ID,
      })

      continue
    }
  }
}

init()
