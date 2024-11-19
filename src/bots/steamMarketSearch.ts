import 'dotenv/config'

import { format } from 'date-fns'
import Bottleneck from 'bottleneck'
import { getMarketRender, getSearchMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { generateSteamMessage, sleep } from '../utils'
import { getIPInspectItemInfo } from '../api/pricempire'
import { getBuff163MarketGoods } from '../api/buff163'

const CASHED_LISTINGS = new Set<string>()
const STICKER_PRICES = new Map<string, number>()
const SEARCH_MARKET_DATA: Record<string, { price: number; quantity: number }> = {}

const limiter = new Bottleneck({ maxConcurrent: 1 })

const MARKET_CONFIG = [
  {
    query: 'Holo',
    start: 0,
    count: 60,
  },
]

const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}

const findSteamItemInfo = async (config: { query: string; start: number; count: number }) => {
  try {
    const searchResult = await getSearchMarketRender({ ...config })

    for (const result of searchResult.results) {
      const quantity = result.sell_listings
      const price = Number((result.sell_price / 100).toFixed(2))
      const market_hash_name = result.asset_description.market_hash_name

      if (market_hash_name in SEARCH_MARKET_DATA && SEARCH_MARKET_DATA[market_hash_name].price === price) {
        continue
      }

      if (market_hash_name in SEARCH_MARKET_DATA && SEARCH_MARKET_DATA[market_hash_name].quantity === quantity) {
        continue
      }

      if (market_hash_name in SEARCH_MARKET_DATA && SEARCH_MARKET_DATA[market_hash_name].price > price) {
        const now = format(new Date(), 'HH:mm:ss')

        const steam = await getMarketRender({ market_hash_name, filter: config.query, start: 0, count: 2 })

        console.log(`${now}: ${market_hash_name} $${SEARCH_MARKET_DATA[market_hash_name].price} -> $${price}`)

        for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
          if (CASHED_LISTINGS.has(listingId)) continue

          const currentListing = steam.listinginfo[listingId]
          const link = currentListing.asset.market_actions[0].link

          const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))
          const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)

          try {
            const response = await getIPInspectItemInfo({ url: inspectLink })
            await sleep(1_000)

            const stickerTotalPrice = (response.iteminfo?.stickers || []).reduce(
              (acc, { wear, name }) => (wear === null ? acc + (STICKER_PRICES.get(`Sticker | ${name}`) ?? 0) : acc),
              0
            )

            if (stickerTotalPrice === 0) continue

            await sendMessage(
              generateSteamMessage({
                price: price,
                name: market_hash_name,
                float: response.iteminfo.floatvalue,
                stickers: response.iteminfo?.stickers || [],
                stickerTotal: stickerTotalPrice,
                position: index + 1,
                filter: config.query,
              })
            )
          } catch (error) {
            console.log(now, `ERROR: Failed to inspect item from pricempire.com`)
          }

          CASHED_LISTINGS.add(listingId)
        }
      }

      SEARCH_MARKET_DATA[market_hash_name] = { price, quantity }
    }
  } catch (error) {
    const now = format(new Date(), 'HH:mm:ss')

    console.log(now, `ERROR: Failed to load query ${config.query}`)
  }
}

;(async () => {
  const pages = Array.from({ length: 100 }, (_, i) => i + 1)
  for (const page_num of pages) {
    const goods = await getBuff163MarketGoods({
      page_num,
      category_group: 'sticker',
      sort_by: 'sell_num.desc',
      min_price: 1,
    })
    for (const item of goods.data.items) {
      const market_hash_name = item.market_hash_name
      const price = Number((Number(item.sell_min_price) * 0.1375).toFixed(2))
      console.log(page_num, market_hash_name, price, item.sell_num)
      STICKER_PRICES.set(market_hash_name, price)
    }
    if (goods.data.items.length !== 50) break
    await sleep(5_000)
  }

  do {
    await Promise.allSettled(MARKET_CONFIG.map((config) => limiter.schedule(() => findSteamItemInfo(config))))

    await sleep(30_000) // Sleep 30s between requests

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
