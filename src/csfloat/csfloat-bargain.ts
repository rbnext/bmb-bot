import 'dotenv/config'

import schedule from 'node-schedule'
import { sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { format, isAfter, subMinutes } from 'date-fns'
import { getBuyOrders, getCSFloatListings, postCreateBargain } from '../api/csfloat'
import axios from 'axios'
import { CSFloatListingItemStickerItem } from '../types'

const CASHED_LISTINGS = new Set<string>()

const MIN_PRICE = 2500
const MAX_PRICE = 9000

const hasStickerCombo = (stickers: CSFloatListingItemStickerItem[]) => {
  const stickersGroupedById = stickers.reduce<Record<string, number>>((acc, { name }) => {
    acc[name] = (acc[name] || 0) + 1
    return acc
  }, {})
  return Object.values(stickersGroupedById).some((count) => count === 4 || count === 5)
}

const isLessThanXMinutes = (date: string, minutes = 1) => {
  return isAfter(new Date(date), subMinutes(new Date(), minutes))
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
    const predictedPrice = data.reference.predicted_price
    const totalTrades = data.seller.statistics.total_trades || 0
    const isSouvenir = data.item.is_souvenir
    const market_hash_name = data.item.market_hash_name
    const minOfferPrice = data.min_offer_price || 0
    const maxOfferDiscount = data.max_offer_discount || 0
    const createdAt = data.created_at

    const stickers = data.item.stickers || []
    const stickerTotal = stickers.reduce((acc, { reference }) => acc + (reference?.price || 0), 0)
    const hasBadWear = stickers.some((sticker) => !!sticker.wear)
    const hasCombo = hasStickerCombo(stickers)

    const overpayment = Number((((currentPrice - predictedPrice) / predictedPrice) * 100).toFixed(2))

    const SP = ((minOfferPrice + 10 - predictedPrice) / stickerTotal) * 100

    if (
      isSouvenir ||
      overpayment > 10 ||
      quantity < 50 ||
      totalTrades >= 50 ||
      maxOfferDiscount <= 250 ||
      market_hash_name.includes('M4A4 ') ||
      !isLessThanXMinutes(createdAt, 2) ||
      hasBadWear
    ) {
      continue
    }

    const orders = await getBuyOrders({ id: data.id })
    const simpleOrders = orders.filter((i) => !!i.market_hash_name)

    const top3Orders = simpleOrders.slice(0, 3)
    const min = Math.min(...top3Orders.map((i) => i.price))
    const max = Math.max(...top3Orders.map((i) => i.price))

    const bargainPrice = minOfferPrice + 10

    const now = format(new Date(), 'HH:mm:ss')
    console.log(now, market_hash_name, (currentPrice - bargainPrice) / 100, max - min, SP)

    if (simpleOrders[0].price > bargainPrice && max - min <= 30) {
      const message: string[] = []
      message.push(`🤝 <b>[BARGAIN][CSFLOAT]</b>` + ' ')
      message.push(`<a href="https://csfloat.com/item/${data.id}">${market_hash_name}</a>\n\n`)

      message.push(`<b>Price</b>: <s>$${currentPrice / 100}</s> $${bargainPrice / 100}\n`)
      message.push(`<b>Lowest buy order</b>: $${simpleOrders[0].price / 100}\n`)
      if (stickerTotal !== 0) message.push(`<b>Stickers total</b>: $${stickerTotal / 100}\n\n`)
      message.push(`<b>Float</b>: ${floatValue}`)

      await postCreateBargain({ contract_id: data.id, price: bargainPrice })
      await sendMessage(message.join(''), undefined, process.env.TELEGRAM_REPORT_ID)
      await sleep(10_000)
    } else if (SP < 2) {
      //
    }

    CASHED_LISTINGS.add(data.id)
  }
}

schedule.scheduleJob(`${process.env.SPEC} * * * * *`, async () => {
  handler().catch((error) => {
    const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message : error.message

    sendMessage(`CSFloat bargain error: ${errorMessage}`).then(() => {
      process.exit(1)
    })
  })
})
