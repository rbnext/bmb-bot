import 'dotenv/config'

import schedule from 'node-schedule'
import { median } from '../utils'
import { sendMessage } from '../api/telegram'
import { format } from 'date-fns'
import { getCSFloatListings, getCSFloatSimpleListings } from '../api/csfloat'

const CASHED_LISTINGS = new Set<string>()

const MIN_PRICE = 500
const MAX_PRICE = 10000

const isSweetFloat = (floatValue: number) => {
  return floatValue < 0.02 || (floatValue >= 0.07 && floatValue < 0.08) || (floatValue >= 0.15 && floatValue < 0.16)
}

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
    const basePrice = data.reference.base_price
    const totalTrades = data.seller.statistics.total_trades || 0
    const isSouvenir = data.item.is_souvenir
    const market_hash_name = data.item.market_hash_name

    const charm = data.item.keychains?.[0]
    const charmPrice = charm?.reference?.price || 0

    const stickers = data.item.stickers || []
    const hasCombo = stickers.length === 4 && stickers.every(({ stickerId }) => stickerId === stickers[0].stickerId)
    const stickerTotal = stickers.reduce((acc, { reference }) => acc + (reference?.price || 0), 0)
    const hasBadWear = stickers.some((sticker) => !!sticker.wear)

    if (isSouvenir || currentPrice > basePrice * 1.2 || quantity <= 100 || totalTrades >= 100 || hasBadWear) {
      continue
    }

    if (!(charmPrice > 50 || stickerTotal >= 3000 || (currentPrice >= 2000 && isSweetFloat(floatValue)))) {
      continue
    }

    const simpleListings = await getCSFloatSimpleListings({ id: data.id })
    const filteredListings = simpleListings.filter((i) => i.type === 'buy_now')
    const listingMedianPrice = median(filteredListings.map((i) => i.price))
    const maxListingPrice = Math.max(...filteredListings.map((i) => i.price))
    const minListingPrice = Math.min(...filteredListings.map((i) => i.price))

    console.log(format(new Date(), 'HH:mm:ss'), {
      market_hash_name,
      listingMedianPrice,
      currentPrice,
      stickerTotal,
      charmPrice,
      floatValue,
    })

    if ((maxListingPrice / minListingPrice - 1) * 100 < 10) {
      const estimatedToBeSold = listingMedianPrice + stickerTotal * (hasCombo ? 0.1 : 0.05) + charmPrice - 33
      const estimatedProfitPercent = (estimatedToBeSold / currentPrice - 1) * 100

      const floatLink = `https://csfloat.com/search?market_hash_name=${market_hash_name}&sort_by=lowest_price&type=buy_now`

      const message: string[] = []
      message.push(`<a href="${floatLink}">${market_hash_name}</a>\n\n`)

      if (estimatedProfitPercent >= 5) {
        if (charm) {
          message.push(`<b>${charm.name}</b> ($${charmPrice / 100}) #${charm.pattern}\n\n`)
        }
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
      } else if (isSweetFloat(floatValue)) {
        const response = await getCSFloatListings({
          market_hash_name,
          ...(market_hash_name.includes('Factory New') && { max_float: 0.02 }),
          ...(market_hash_name.includes('Minimal Wear') && { max_float: 0.08 }),
          ...(market_hash_name.includes('Field-Tested') && { max_float: 0.16 }),
        })

        const lowestPriceByFloat = response.data[0].price / 100

        message.push(`<b>Price</b>: $${currentPrice / 100}\n`)
        message.push(`<b>Lowest price</b>: $${minListingPrice / 100}\n`)
        message.push(`<b>Lowest price(by float)</b>: $${lowestPriceByFloat}\n\n`)
        message.push(`<b>Float</b>: ${floatValue}`)
        await sendMessage(message.join(''), undefined, process.env.TELEGRAM_REPORT_ID)
      }
    }

    CASHED_LISTINGS.add(data.id)
  }
}

try {
  schedule.scheduleJob(`${process.env.SPEC} * * * * *`, handler)
} catch (error) {
  console.error(error)

  await sendMessage(`${process.env.SPEC} - ${error.message}`)
}
