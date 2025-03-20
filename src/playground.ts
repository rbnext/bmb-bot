import 'dotenv/config'

import { sleep } from './utils'
import { csMoneyAddToCart, csMoneyPurchase, getCSMoneyListings } from './api/cs'
import { getBuyOrders, getCSFloatListings } from './api/csFloat'
import { sendMessage } from './api/telegram'
import { format } from 'date-fns'
import path from 'path'
import { readFileSync, writeFileSync } from 'fs'
import axios from 'axios'

const CASHED_LISTINGS = new Set<number>()
const CS_FLOAT_PRICES: Record<string, number> = {}

const init = async () => {
  const csMoneyPayload = { items: [{ id: String(29677358), price: 0.02 }] }

  try {
    await csMoneyAddToCart(csMoneyPayload)
    const response = await csMoneyPurchase(csMoneyPayload)

    console.log(response)
  } catch (error) {
    console.log(error)
    if (axios.isAxiosError(error)) {
      console.log(error.response?.data)
    }
  }
}

init()

// const init = async () => {
//   const response = await getCSMoneyListings({ limit: 60, offset: 0, minPrice: 5, maxPrice: 40 })

//   for (const item of response.items) {
//     const now = format(new Date(), 'HH:mm:ss')
//     if (CASHED_LISTINGS.has(item.asset.id)) {
//       continue
//     }
//     console.log(now, item.asset.names.full, item.pricing.basePrice)

//     if (CS_FLOAT_PRICES[item.asset.names.full] && CS_FLOAT_PRICES[item.asset.names.full] > item.pricing.basePrice) {
//       await sendMessage({ text: `${item.asset.names.full} - $${item.pricing.basePrice}` })
//     }

//     CASHED_LISTINGS.add(item.asset.id)
//   }
//   await sleep(2_000)

//   init()
// }

// ;(async () => {
//   const itemsIdsPath = path.join(__dirname, '../items-ids.json')
//   const itemsIds: Record<string, string> = JSON.parse(readFileSync(itemsIdsPath, 'utf8'))

//   for (const name in itemsIds) {
//     const response = await getBuyOrders({ id: itemsIds[name] })
//     const simpleOrders = response.filter((i) => !!i.market_hash_name)

//     if (simpleOrders.length === 0) {
//       continue
//     }

//     CS_FLOAT_PRICES[name] = Number((simpleOrders[0].price / 100).toFixed(2))

//     console.log(name, CS_FLOAT_PRICES[name])

//     await sleep(3_000)
//   }

//   init()
// })()
