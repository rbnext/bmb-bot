import 'dotenv/config'

import { format } from 'date-fns'
import { csMoneyAddToCart, csMoneyPurchase, getCSMoneyListings } from '../api/cs'
import { generateMessage, sleep } from '../utils'
import { getMarketGoods } from '../api/buff'
import { CSMoneyItem, MessageType, Source } from '../types'
import { getCSFloatListings } from '../api/csfloat'
import { sendMessage } from '../api/telegram'
import axios from 'axios'

const goodsCache = new Set<number>()
const steamUsersBlacklist = new Set<string>()
const buffGoodsPrices: Record<string, { price: number; goods_id: number }> = {}

const MIN_PRICE = 2
const MAX_PRICE = 40

const isSweetItem = (item: CSMoneyItem) => {
  const name = item.asset.names.full
  const price = Number(item.pricing.basePrice)
  const float = item.asset.float

  if (name === 'Glock-18 | Gold Toof (Minimal Wear)' && float > 0.07 && float < 0.08 && price < 32) {
    return true
  }

  if (name === 'Glock-18 | Gold Toof (Field-Tested)' && float > 0.15 && float < 0.16 && price < 14) {
    return true
  }

  return false
}

const csMoneyTrade = async (item: CSMoneyItem) => {
  const market_hash_name = item.asset.names.full
  const currentPrice = Number(item.pricing.basePrice)
  const goods_id = buffGoodsPrices[market_hash_name].goods_id
  const stickers = item.stickers || []

  const stickerTotal = stickers.reduce((acc, sticker) => {
    return sticker ? (sticker.wear === 0 ? acc + Number(sticker.pricing.default) : acc) : acc
  }, 0)

  const payload = {
    id: goods_id,
    price: currentPrice,
    name: market_hash_name,
    float: item.asset.float,
    type: MessageType.Review,
    source: Source.CSMONEY,
    stickerTotal,
  }

  const listings = await getCSFloatListings({ market_hash_name })

  if (listings.data.length >= 20) {
    const price = listings.data[3].price
    const basePrice = listings.data[0].reference.base_price
    const medianPrice = Math.min(basePrice, price) / 100
    const estimatedProfit = Number((((medianPrice - currentPrice) / currentPrice) * 100).toFixed(2))

    console.log('-', market_hash_name, estimatedProfit + '%', stickerTotal.toFixed(2))

    if (estimatedProfit > (currentPrice >= 5 ? 15 : 25)) {
      try {
        await csMoneyPurchase({
          items: [{ id: String(item.id), price: currentPrice }],
        })

        sendMessage({
          text: generateMessage({ ...payload, estimatedProfit, medianPrice, type: MessageType.Purchased }),
        })
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.log(error.response?.data)
          sendMessage({ text: JSON.stringify(error.response?.data) })
        }
      }
    } else if (estimatedProfit > 5) {
      const extra: string[] = []
      extra.push(`<a href="https://cs.money/market/buy/?search=${market_hash_name}">CSMoney</a>`)
      extra.push(`<a href="https://csfloat.com/search?market_hash_name=${market_hash_name}">CSFloat</a>`)

      sendMessage({
        text: generateMessage({ ...payload, estimatedProfit, medianPrice, extra: extra.join(' | ') }),
      })
    } else if (estimatedProfit < 0) {
      buffGoodsPrices[market_hash_name].price = medianPrice
    }
  }
}

const csMoney = async () => {
  const response = await getCSMoneyListings({ minPrice: MIN_PRICE, maxPrice: MAX_PRICE })

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
      goodsCache.has(item.id) ||
      steamUsersBlacklist.has(item.seller.steamId64) ||
      !buffGoodsPrices[market_hash_name] ||
      typeof item.seller.botId === 'number'
    ) {
      continue
    }

    if (
      item.asset.quality === 'fn' ||
      item.asset.quality === 'mw' ||
      item.asset.quality === 'ft' ||
      item.asset.quality === 'ww' ||
      item.asset.quality === 'bs' ||
      item.asset.type === 18 ||
      item.asset.type === 10
    ) {
      console.log(`${now}: ${market_hash_name} $${currentPrice}`)

      const payload = {
        price: currentPrice,
        name: market_hash_name,
        float: item.asset.float,
        type: MessageType.Review,
        source: Source.CSMONEY,
      }

      if (isSweetItem(item)) {
        try {
          await csMoneyPurchase({ items: [{ id: String(item.id), price: currentPrice }] })
          await sendMessage({ text: generateMessage({ ...payload, id: 0, type: MessageType.Purchased }) })
        } catch (error) {
          if (axios.isAxiosError(error)) {
            console.log(error.response?.data)
            sendMessage({ text: JSON.stringify(error.response?.data) })
          }
        }
      } else if (buffGoodsPrices[market_hash_name].price > currentPrice) {
        csMoneyTrade(item)
      }
    }

    goodsCache.add(item.id)
  }
  await sleep(2_000)

  csMoney()
}

;(async () => {
  const pages = Array.from({ length: 100 }, (_, i) => i + 1)

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
