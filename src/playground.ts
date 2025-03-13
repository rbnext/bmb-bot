import 'dotenv/config'

import { sleep } from './utils'
import { getCSMoneyListings } from './api/cs'
import { sendMessage } from './api/telegram'
import { format } from 'date-fns'

const CASHED_LISTINGS = new Set<number>()

const init = async () => {
  const response = await getCSMoneyListings({ limit: 60, offset: 0, minPrice: 10, maxPrice: 40 })

  for (const item of response.items) {
    const now = format(new Date(), 'HH:mm:ss')

    if (CASHED_LISTINGS.has(item.id)) {
      continue
    }

    console.log(now, item.asset.names.full, item.pricing.basePrice)

    if (item.pricing.discount > 0.1) {
      await sendMessage({ text: `${item.asset.names.full} - $${item.pricing.basePrice}` })
    }

    CASHED_LISTINGS.add(item.id)
  }

  await sleep(2_000)

  init()
}

init()
