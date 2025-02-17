import 'dotenv/config'

import schedule from 'node-schedule'
import { sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { format, formatDistance, isAfter, subMinutes } from 'date-fns'
import { getBuyOrders, getCSFloatListings, postCreateBargain } from '../api/csfloat'

const CASHED_LISTINGS = new Set<string>()
const options = { addSuffix: true, includeSeconds: true }

const MIN_PRICE = 2500
const MAX_PRICE = 5000

export const isLessThanXMinutes = (date: string, minutes = 1) => {
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

    const overpayment = Number((((currentPrice - predictedPrice) / predictedPrice) * 100).toFixed(2))

    if (!isLessThanXMinutes(createdAt, 2)) {
      continue
    }

    if (isSouvenir || overpayment > 10 || quantity < 50 || totalTrades >= 50 || maxOfferDiscount <= 200) {
      continue
    }

    const orders = await getBuyOrders({ id: data.id })
    const simpleOrders = orders.filter((i) => !!i.market_hash_name)

    const top3Orders = simpleOrders.slice(0, 3)
    const min = Math.min(...top3Orders.map((i) => i.price))
    const max = Math.max(...top3Orders.map((i) => i.price))

    const bargainPrice = minOfferPrice + 10

    const now = format(new Date(), 'HH:mm:ss')
    console.log(now, market_hash_name, (currentPrice - bargainPrice) / 100, max - min)

    if (simpleOrders[0].price > bargainPrice && max - min <= 30) {
      const message: string[] = []
      message.push(`🤝 <b>[BARGAIN][CSFLOAT]</b>` + ' ')
      message.push(`<a href="https://csfloat.com/item/${data.id}">${market_hash_name}</a>\n\n`)

      message.push(`<b>Price</b>: <s>$${currentPrice / 100}</s> $${bargainPrice / 100}\n`)
      message.push(`<b>Lowest buy order</b>: $${simpleOrders[0].price / 100}\n`)

      message.push(`<b>Created at</b>: ${formatDistance(new Date(createdAt), new Date(), options)}\n`)
      message.push(`<b>Float</b>: ${floatValue}`)

      await postCreateBargain({ contract_id: data.id, price: bargainPrice })
      await sendMessage(message.join(''), undefined, process.env.TELEGRAM_REPORT_ID)
    }
    await sleep(500)
    CASHED_LISTINGS.add(data.id)
  }
}

schedule.scheduleJob(`${process.env.SPEC} * * * * *`, handler)
