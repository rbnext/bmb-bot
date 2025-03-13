import 'dotenv/config'

import { sleep } from './utils'
import { getCSMoneyListings } from './api/cs'
import { getCSFloatListings } from './api/csFloat'
import { sendMessage } from './api/telegram'
import { format } from 'date-fns'
import path from 'path'
import { readFileSync, writeFileSync } from 'fs'

const CASHED_LISTINGS = new Set<number>()

const topFloatItemsPath = path.join(__dirname, '../../top-float-items.json')
const itemsIdsPath = path.join(__dirname, '../../items-ids.json')

const mostPopularItems: Record<string, number> = JSON.parse(readFileSync(topFloatItemsPath, 'utf8'))

const init = async () => {
  for (const market_hash_name in mostPopularItems) {
    const response = await getCSFloatListings({ market_hash_name })

    const data: Record<string, number> = JSON.parse(readFileSync(itemsIdsPath, 'utf8'))
    writeFileSync(itemsIdsPath, JSON.stringify({ ...data, [market_hash_name]: response.data[0].id }, null, 4))

    await sleep(2_000)
  }

  // const response = await getCSMoneyListings({ limit: 60, offset: 0, minPrice: 10, maxPrice: 40 })
  // for (const item of response.items) {
  //   const now = format(new Date(), 'HH:mm:ss')
  //   if (CASHED_LISTINGS.has(item.asset.id)) {
  //     continue
  //   }
  //   console.log(now, item.asset.names.full, item.pricing.basePrice)
  //   if (item.pricing.discount > 0.1) {
  //     await sendMessage({ text: `${item.asset.names.full} - $${item.pricing.basePrice}` })
  //   }
  //   CASHED_LISTINGS.add(item.asset.id)
  // }
  // await sleep(2_000)
  // init()
}

init()
