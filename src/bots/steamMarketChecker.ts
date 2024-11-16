import 'dotenv/config'

import { format } from 'date-fns'
import Bottleneck from 'bottleneck'
import { getMarketRender } from '../api/steam'
import { getMarketGoods } from '../api/buff'
import { sendMessage } from '../api/telegram'
import { generateSteamMessage, sleep } from '../utils'
import { getIPInspectItemInfo } from '../api/pricempire'

const CASHED_LISTINGS = new Set<string>()
const STICKER_PRICES = new Map<string, number>()
const MIN_TREADS: number = 4

const limiter = new Bottleneck({ maxConcurrent: MIN_TREADS })

const MARKET_HASH_NAMES = [
  'AWP | Asiimov (Battle-Scarred)',
  'Desert Eagle | Printstream (Minimal Wear)',
  'M4A1-S | Black Lotus (Factory New)',
  'AK-47 | Redline (Field-Tested)',
]

const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}

const findSteamItemInfo = async (market_hash_name: string) => {
  const now = format(new Date(), 'HH:mm:ss')

  try {
    const steam = await getMarketRender({ market_hash_name })

    for (const listingId of Object.keys(steam.listinginfo)) {
      if (CASHED_LISTINGS.has(listingId)) continue

      const currentListing = steam.listinginfo[listingId]
      const link = currentListing.asset.market_actions[0].link

      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))
      const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)

      try {
        const response = await getIPInspectItemInfo({ url: inspectLink })

        const stickerTotalPrice = (response.iteminfo?.stickers || []).reduce(
          (acc, { wear, name }) => (wear === null ? acc + (STICKER_PRICES.get(`Sticker | ${name}`) ?? 0) : acc),
          0
        )

        if (stickerTotalPrice >= price) {
          await sendMessage(
            generateSteamMessage({
              price: price,
              name: market_hash_name,
              float: response.iteminfo.floatvalue,
              stickers: response.iteminfo?.stickers || [],
              stickerTotal: stickerTotalPrice,
            })
          )
        }

        console.log(
          now,
          market_hash_name,
          '$' + price,
          response.iteminfo.floatvalue,
          '$' + stickerTotalPrice.toFixed(2)
        )
      } catch (error) {
        console.log(now, `ERROR: Failed to inspect item from pricempire.com`)
      }

      CASHED_LISTINGS.add(listingId)

      await sleep(1_000)
    }
  } catch (error) {
    console.log('error')
    console.log(now, `ERROR:`, error.message)
  }
}

;(async () => {
  const pages = Array.from({ length: 100 }, (_, i) => i + 1)

  for (const page_num of pages) {
    const goods = await getMarketGoods({
      page_num,
      category_group: 'sticker',
      sort_by: 'sell_num.desc',
    })
    for (const item of goods.data.items) STICKER_PRICES.set(item.market_hash_name, Number(item.sell_min_price))
    if (goods.data.items.length !== 50) break
    await sleep(5_000)
  }

  do {
    const results = await Promise.allSettled(
      MARKET_HASH_NAMES.map((name) => {
        return limiter.schedule(() => findSteamItemInfo(name))
      })
    )

    if (results.every((result) => result.status === 'rejected')) {
      break // Exit the loop if all responses are errors
    }

    await sleep(60_000) // Sleep 60s between requests

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
