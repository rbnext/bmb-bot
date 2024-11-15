import 'dotenv/config'

import { format } from 'date-fns'
import { getMarketRender } from '../api/steam'
import { getMarketGoods } from '../api/buff'
import { sleep } from '../utils'
import { getIPInspectItemInfo } from '../api/pricempire'

const CASHED_LISTINGS = new Set<string>()
const STICKER_PRICES = new Map<string, number>()

const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}

export const steamMarketChecker = async () => {
  try {
    for (const market_hash_name of [
      'M4A4 | Temukau (Field-Tested)',
      'Glock-18 | Water Elemental (Minimal Wear)',
      'Desert Eagle | Conspiracy (Factory New)',
    ]) {
      const steam = await getMarketRender({ market_hash_name })

      for (const listingId of Object.keys(steam.listinginfo)) {
        const now = format(new Date(), 'HH:mm:ss')

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

          console.log(now, market_hash_name, price, response.iteminfo.floatvalue, stickerTotalPrice)
        } catch (error) {
          console.log('error', error.message)
          console.log(now, 'failed to get data for', inspectLink)
        }

        CASHED_LISTINGS.add(listingId)
      }

      await sleep(50_000)
    }
  } catch (error) {
    console.log('error', error.message)

    return
  }

  await sleep(70_000)

  steamMarketChecker()
}
;(async () => {
  const pages = Array.from({ length: 50 }, (_, i) => i + 1)

  for (const page_num of pages) {
    const goods = await getMarketGoods({ page_num, category_group: 'sticker' })
    for (const item of goods.data.items) STICKER_PRICES.set(item.market_hash_name, Number(item.sell_min_price))
    console.log(page_num, goods.data.items.length)
    if (goods.data.items.length !== 50) break
    await sleep(5_000)
  }

  steamMarketChecker()
})()
