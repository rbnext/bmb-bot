import 'dotenv/config'

import schedule from 'node-schedule'
import { sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { getBuyOrders, getCSFloatListings, getPlacedOrders } from '../api/csfloat'
import axios from 'axios'

const regex =
  /\(DefIndex == (\d+) and PaintIndex == (\d+) and FloatValue >= ([\d.]+) and FloatValue < ([\d.]+) and StatTrak == (true|false)\)/

const handler = async () => {
  const response = await getPlacedOrders({ page: 0, limit: 100 })

  for (const item of response.orders) {
    if (
      !(
        item.expression &&
        item.expression!.includes('StatTrak ==') &&
        item.expression!.includes('FloatValue >=') &&
        item.expression!.includes('FloatValue <') &&
        item.price <= 5000
      )
    ) {
      continue
    }

    const match = item.expression.match(regex)

    if (!match) {
      throw new Error(`Failed to match expression: (${item.expression})`)
    }

    const [, defIndex, paintIndex, minFloat, maxFloat, statTrak] = match

    console.log(defIndex, paintIndex, minFloat, maxFloat, statTrak)

    const listings = await getCSFloatListings({
      def_index: defIndex,
      paint_index: paintIndex,
      category: statTrak === 'true' ? 2 : 1,
      min_float: Number(minFloat),
      max_float: Number(maxFloat),
    })

    const listingId = listings.data[0].id
    const marketHashName = listings.data[0].item.market_hash_name

    const orders = await getBuyOrders({ id: listingId })
    const filteredAdvancedOrders = orders.filter((i) => !!i.expression)

    const itemIndex = filteredAdvancedOrders.findIndex(
      (i) => i.expression === item.expression && i.price === item.price
    )

    const messages: string[] = []
    messages.push('<b>[ADVANCED_ORDER]</b> ')
    messages.push(`<a href="https://csfloat.com/item/${listingId}">${marketHashName}</a> - `)

    console.log(marketHashName, itemIndex + 1)

    if (itemIndex === -1) {
      messages.push(`Expression not found`)
    } else if (
      itemIndex === 0 &&
      filteredAdvancedOrders[itemIndex].price - filteredAdvancedOrders[itemIndex + 1].price >= 2
    ) {
      messages.push(`Lower your position to save budget`)
    } else if (itemIndex > 0 && filteredAdvancedOrders[0].price - filteredAdvancedOrders[itemIndex].price <= 20) {
      messages.push(`You've been overrun, now your position: ${itemIndex + 1}`)
    }

    if (messages.length === 3) {
      await sendMessage(messages.join(''))
    }

    await sleep(10_000)
  }
}

handler()

schedule.scheduleJob(`11,44 * * * *`, async () => {
  handler().catch((error) => {
    const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message : error.message

    sendMessage(`CSFloat buy order error: ${errorMessage}`).then(() => {
      process.exit(1)
    })
  })
})
