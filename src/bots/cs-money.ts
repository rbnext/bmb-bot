import 'dotenv/config'

import { format } from 'date-fns'
import { getCSMoneyListings } from '../api/cs'
import { generateMessage, sleep } from '../utils'
import { getMarketGoods } from '../api/buff'
import { CSMoneyItem, MessageType, Source } from '../types'
import { getCSFloatListings } from '../api/csfloat'
import { sendMessage } from '../api/telegram'

const goodsCache = new Set<number>()
const steamUsersBlacklist = new Set<string>()
const buffGoodsPrices: Record<string, { price: number; goods_id: number }> = {}

const MIN_PRICE = 5
const MAX_PRICE = 30

const csMoneyTrade = async (item: CSMoneyItem) => {
  const market_hash_name = item.asset.names.full
  const currentPrice = Number(item.pricing.basePrice)
  const goods_id = buffGoodsPrices[market_hash_name].goods_id

  const payload = {
    id: goods_id,
    price: currentPrice,
    name: market_hash_name,
    float: item.asset.float,
    type: MessageType.Review,
    source: Source.CSMONEY_CSFLOAT,
  }

  const listings = await getCSFloatListings({ market_hash_name })

  if (listings.data.length >= 20) {
    const price = listings.data[3].price
    const basePrice = listings.data[0].reference.base_price
    const medianPrice = Math.min(basePrice, price) / 100
    const estimatedProfit = Number((((medianPrice - currentPrice) / currentPrice) * 100).toFixed(2))

    console.log('-', market_hash_name, estimatedProfit + '%')

    if (estimatedProfit > 5) {
      sendMessage({
        text: generateMessage({ ...payload, estimatedProfit, medianPrice, source: Source.BUFF_COMBO }),
      })
    }
  }
}

const csMoney = async () => {
  const response = await getCSMoneyListings({ limit: 60, offset: 0, minPrice: MIN_PRICE, maxPrice: MAX_PRICE })

  const groupedBySteamId = response.items.reduce<Record<string, number>>((acc, item) => {
    if (!item.seller.botId) {
      return { ...acc, [item.seller.steamId64]: (acc[item.seller.steamId64] || 0) + 1 }
    }

    return acc
  }, {})

  for (const steamId in groupedBySteamId) {
    if (groupedBySteamId[steamId] > 10) steamUsersBlacklist.add(steamId)
  }

  for (const item of response.items) {
    const now = format(new Date(), 'HH:mm:ss')
    const market_hash_name = item.asset.names.full
    const currentPrice = Number(item.pricing.basePrice)

    if (
      !item.asset.float ||
      goodsCache.has(item.id) ||
      steamUsersBlacklist.has(item.seller.steamId64) ||
      !buffGoodsPrices[market_hash_name] ||
      typeof item.seller.botId === 'number'
    ) {
      continue
    }

    if (buffGoodsPrices[market_hash_name].price > currentPrice) {
      csMoneyTrade(item)
    }

    console.log(`${now}: ${market_hash_name} $${currentPrice}`)

    goodsCache.add(item.id)
  }
  await sleep(2_000)

  csMoney()
}

;(async () => {
  const pages = Array.from({ length: 80 }, (_, i) => i + 1)

  for (const page_num of pages) {
    const goods = await getMarketGoods({ page_num, min_price: MIN_PRICE, max_price: MAX_PRICE })

    for (const item of goods.data.items) {
      buffGoodsPrices[item.market_hash_name] = { price: Number(item.sell_min_price), goods_id: item.id }
    }

    if (goods.data.items.length !== 50) break
    await sleep(3_000)
  }

  console.log('Loaded items: ', Object.keys(buffGoodsPrices).length)

  csMoney()
})()
