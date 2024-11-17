import 'dotenv/config'

import { format } from 'date-fns'
import Bottleneck from 'bottleneck'
import { getMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { generateSteamMessage, sleep } from '../utils'
import { getIPInspectItemInfo } from '../api/pricempire'
import { getBuff163MarketGoods } from '../api/buff163'

const CASHED_LISTINGS = new Set<string>()
const STICKER_PRICES = new Map<string, number>()
const MIN_TREADS: number = 2

const limiter = new Bottleneck({ maxConcurrent: MIN_TREADS })

const MARKET_HASH_NAMES = [
  'AK-47 | Slate (Field-Tested)',
  'AK-47 | Phantom Disruptor (Field-Tested)',
  'AK-47 | Emerald Pinstripe (Field-Tested)',
  'AK-47 | Ice Coaled (Field-Tested)',
  'AK-47 | Nightwish (Field-Tested)',
]

const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}

const findSteamItemInfo = async (market_hash_name: string) => {
  const now = format(new Date(), 'HH:mm:ss')

  try {
    const steam = await getMarketRender({ market_hash_name })

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
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
              position: index + 1,
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
    console.log(now, `ERROR: Failed to inspect ${market_hash_name} from steamcommunity.com`)
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
    const results = await Promise.allSettled(
      MARKET_HASH_NAMES.map((name) => {
        return limiter.schedule(() => findSteamItemInfo(name))
      })
    )

    if (results.every((result) => result.status === 'rejected')) {
      break // Exit the loop if all responses are errors
    }

    await sleep(50_000) // Sleep 50s between requests

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
