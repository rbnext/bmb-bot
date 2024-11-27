import 'dotenv/config'

import { format } from 'date-fns'
import { getMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { extractStickers, generateSteamMessage, sleep } from '../utils'

const CASHED_LISTINGS = new Set<string>()
const STICKER_PRICES = new Map<string, number>()

const MARKET_HASH_NAMES = [
  'AK-47 | Redline (Field-Tested)',
  'AK-47 | Blue Laminate (Minimal Wear)',
  'USP-S | Blueprint (Factory New)',
  'Glock-18 | Candy Apple (Minimal Wear)',
]

const findSteamItemInfo = async (market_hash_name: string, start: number = 0) => {
  console.log(format(new Date(), 'HH:mm:ss'), market_hash_name, start)

  await sleep(20_000)

  try {
    const steam = await getMarketRender({ market_hash_name, start, count: 100 })

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      if (CASHED_LISTINGS.has(listingId)) continue

      const currentListing = steam.listinginfo[listingId]
      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))

      const assetInfo = steam.assets[730][currentListing.asset.contextid][currentListing.asset.id]
      const htmlDescription = assetInfo.descriptions.find((el) => el.value.includes('sticker_info'))?.value || ''

      const stickers = extractStickers(htmlDescription)

      const stickerTotalPrice = stickers.reduce((acc, name) => acc + (STICKER_PRICES.get(`Sticker | ${name}`) ?? 0), 0)

      if (price >= 100) return

      if (price && price <= 100 && stickerTotalPrice !== 0 && price / stickerTotalPrice < 0.2) {
        await sendMessage(
          generateSteamMessage({
            price: price,
            name: market_hash_name,
            stickers: stickers,
            stickerTotal: stickerTotalPrice,
            ratio: price / stickerTotalPrice,
            position: start + index + 1,
          })
        )
      }

      CASHED_LISTINGS.add(listingId)
    }

    if (start + 100 < steam.total_count) {
      await findSteamItemInfo(market_hash_name, start + 100)
    }
  } catch (error) {
    console.log(format(new Date(), 'HH:mm:ss'), 'STEAM_ERROR', error.message)
    await sleep(60_000 * 5)

    return
  }
}

;(async () => {
  const pages = Array.from({ length: 115 }, (_, i) => i + 1)

  // for (const page_num of pages) {
  //   const goods = await getBuff163MarketGoods({
  //     page_num,
  //     category_group: 'sticker',
  //     sort_by: 'price.desc',
  //   })
  //   for (const item of goods.data.items) {
  //     const market_hash_name = item.market_hash_name
  //     const price = Number((Number(item.sell_min_price) * 0.1375).toFixed(2))
  //     console.log(page_num, market_hash_name, price, item.sell_num)
  //     STICKER_PRICES.set(market_hash_name, price)
  //   }
  //   if (goods.data.items.length !== 50) break
  //   await sleep(4_000)
  // }

  do {
    for (const market_hash_name of MARKET_HASH_NAMES) {
      await findSteamItemInfo(market_hash_name)
    }

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
