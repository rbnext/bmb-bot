import 'dotenv/config'

import schedule from 'node-schedule'
import { median } from '../utils'
import { sendMessage } from '../api/telegram'
import { format } from 'date-fns'
import { getCSFloatListings, getCSFloatSimpleListings } from '../api/csfloat'

const CASHED_LISTINGS = new Set<string>()

const MIN_PRICE = 500
const MAX_PRICE = 10000

const handler = async () => {
  const response = await getCSFloatListings({
    sort_by: 'most_recent',
    min_price: MIN_PRICE,
    max_price: MAX_PRICE,
    max_float: 0.5,
  })

  for (const data of response.data) {
    if (CASHED_LISTINGS.has(data.id)) continue

    const currentPrice = data.price
    const quantity = data.reference.quantity
    const floatValue = data.item.float_value
    const predictedPrice = data.reference.predicted_price
    const totalTrades = data.seller.statistics.total_trades || 0
    const isSouvenir = data.item.is_souvenir
    const market_hash_name = data.item.market_hash_name

    const stickers = data.item.stickers || []
    const hasCombo = stickers.length === 4 && stickers.every(({ stickerId }) => stickerId === stickers[0].stickerId)
    const stickerTotal = stickers.reduce((acc, { reference }) => acc + (reference?.price || 0), 0)
    const hasBadWear = stickers.some((sticker) => !!sticker.wear)

    const overpayment = Number((((currentPrice - predictedPrice) / predictedPrice) * 100).toFixed(2))

    if (isSouvenir || overpayment > 10 || quantity < 15 || totalTrades >= 100 || hasBadWear) {
      continue
    }

    if (!(stickerTotal >= (hasCombo ? 1000 : 3000))) {
      continue
    }

    const simpleListings = await getCSFloatSimpleListings({ id: data.id })
    const filteredListings = simpleListings.filter((i) => i.type === 'buy_now')
    const listingMedianPrice = median(filteredListings.map((i) => i.price))
    const maxListingPrice = Math.max(...filteredListings.map((i) => i.price))
    const minListingPrice = Math.min(...filteredListings.map((i) => i.price))

    const now = format(new Date(), 'HH:mm:ss')
    console.log(now, market_hash_name, currentPrice / 100, stickerTotal, hasCombo)

    if ((maxListingPrice / minListingPrice - 1) * 100 < 10) {
      const estimatedToBeSold = listingMedianPrice + stickerTotal * (hasCombo ? 0.07 : 0.04)
      const estimatedProfitPercent = (estimatedToBeSold / currentPrice - 1) * 100

      if (estimatedProfitPercent >= 5) {
        const message: string[] = []
        message.push(`<a href="https://csfloat.com/item/${data.id}">${market_hash_name}</a>\n\n`)
        for (const sticker of stickers) {
          message.push(
            `<b>${sticker.name}</b> ($${(sticker.reference?.price || 0) / 100}) ${sticker?.wear ? 'N/A' : '100%'}\n`
          )
        }
        message.push(`\n`)
        message.push(`<b>Price</b>: $${currentPrice / 100}\n`)
        message.push(`<b>Lowest price</b>: $${minListingPrice / 100}\n`)
        message.push(`<b>Median price</b>: $${listingMedianPrice / 100}\n`)
        message.push(
          `<b>Estimated profit</b>: ${estimatedProfitPercent.toFixed(2)}% (if sold for $${(estimatedToBeSold / 100).toFixed(2)})\n\n`
        )
        message.push(`<b>Float</b>: ${floatValue}`)

        await sendMessage(message.join(''), undefined, process.env.TELEGRAM_REPORT_ID)
      }
    }

    CASHED_LISTINGS.add(data.id)
  }
}

schedule.scheduleJob(`${process.env.SPEC} * * * * *`, handler)
