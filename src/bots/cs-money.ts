import 'dotenv/config'

import { format } from 'date-fns'
import { getCSMoneyListings } from '../api/cs'
import { isLessThanThreshold, sleep } from '../utils'
import { CSMoneyItem } from '../types'
import { getMaxPricesForXDays } from '../helpers/getMaxPricesForXDays'

const GOODS_CACHE: Record<string, { price: number }> = {}

const csMoneyTrade = async (item: CSMoneyItem) => {
  const name = item.asset.names.full
  const currentPrice = Number(item.pricing.basePrice)

  const prices = await getMaxPricesForXDays(name)

  const medianPrice = prices.length !== 0 ? Math.min(...prices) : 0
  const estimatedProfit = ((medianPrice - currentPrice) / currentPrice) * 100

  console.log(`${name} - $${currentPrice} - ${estimatedProfit.toFixed(2)}%`)
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

    GOODS_CACHE[name] = {
      price: currentPrice,
    }
  }
  await sleep(2_000)

  csMoney()
}

csMoney()
