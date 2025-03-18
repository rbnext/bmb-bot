import 'dotenv/config'

import { format } from 'date-fns'
import { getCSMoneyListings } from '../api/cs'
import { isLessThanThreshold, sleep } from '../utils'
import { CSMoneyItem } from '../types'

const GOODS_CACHE: Record<string, { price: number }> = {}

const csMoneyTrade = async (item: CSMoneyItem) => {
  const name = item.asset.names.full

  const currentPrice = Number(item.pricing.basePrice)

  console.log(`Buying ${name} for $${currentPrice}`)
}

const csMoney = async () => {
  const response = await getCSMoneyListings({ limit: 60, offset: 0, minPrice: 5, maxPrice: 40 })

  for (const item of response.items) {
    const now = format(new Date(), 'HH:mm:ss')

    const name = item.asset.names.full
    const currentPrice = Number(item.pricing.basePrice)

    if (name in GOODS_CACHE && isLessThanThreshold(GOODS_CACHE[name].price, currentPrice, 0.1)) {
      GOODS_CACHE[name].price = currentPrice

      continue
    }

    if (name in GOODS_CACHE && GOODS_CACHE[name].price > currentPrice) {
      console.log(`${now}: ${name} $${GOODS_CACHE[name].price} -> $${currentPrice}`)
    }

    if (name in GOODS_CACHE && GOODS_CACHE[name].price > currentPrice) {
      csMoneyTrade(item)
    }

    GOODS_CACHE[item.id] = {
      price: currentPrice,
    }
  }
  await sleep(2_000)

  csMoney()
}

csMoney()
