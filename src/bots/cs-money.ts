import 'dotenv/config'

import { format } from 'date-fns'
import { getCSMoneyListings } from '../api/cs'
import { isLessThanThreshold, sleep } from '../utils'
import { CSMoneyItem } from '../types'
import { getMaxPricesForXDays } from '../helpers/getMaxPricesForXDays'

const goodsCache = new Set<number>()

const csMoneyTrade = async (item: CSMoneyItem) => {
  const name = item.asset.names.full
  const currentPrice = Number(item.pricing.basePrice)
}

const csMoney = async () => {
  const response = await getCSMoneyListings({ limit: 60, offset: 0, minPrice: 5, maxPrice: 40 })

  for (const item of response.items) {
    if (goodsCache.has(item.id) || typeof item.seller.botId === 'number') continue

    const now = format(new Date(), 'HH:mm:ss')

    const name = item.asset.names.full
    const currentPrice = Number(item.pricing.basePrice)

    console.log(`${now}: ${name} $${currentPrice}`, item.seller.steamId64)

    goodsCache.add(item.id)
  }
  await sleep(2_000)

  csMoney()
}

csMoney()
