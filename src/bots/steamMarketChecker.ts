import 'dotenv/config'

import { format } from 'date-fns'
import Bottleneck from 'bottleneck'
import { getMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { generateSteamMessage, sleep } from '../utils'
import { getIPInspectItemInfo } from '../api/pricempire'
import { getBuff163MarketGoods } from '../api/buff163'
import { getGoodsInfo, getMarketGoods } from '../api/buff'

const STICKER_PRICES = new Map<string, number>()
const SEARCH_MARKET_DATA: Record<string, number> = {}
const CASHED_LISTINGS = new Set<string>()
const MIN_TREADS: number = 1

const limiter = new Bottleneck({ maxConcurrent: MIN_TREADS })

const MARKET_HASH_NAMES = ['AK-47 | Redline (Field-Tested)']

const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}

const findSteamItemInfo = async (market_hash_name: string) => {
  try {
    const steam = await getMarketRender({ market_hash_name, start: 1000, count: 1, filter: 'Sticker' })

    if (market_hash_name in SEARCH_MARKET_DATA && SEARCH_MARKET_DATA[market_hash_name] === steam.total_count) {
      return
    }

    if (market_hash_name in SEARCH_MARKET_DATA) {
      console.log(
        `${format(new Date(), 'HH:mm:ss')}: ${market_hash_name} ${SEARCH_MARKET_DATA[market_hash_name]} -> ${steam.total_count}`
      )
    }

    if (market_hash_name in SEARCH_MARKET_DATA && SEARCH_MARKET_DATA[market_hash_name] < steam.total_count) {
      const steam = await getMarketRender({ market_hash_name, start: 0, count: 30, filter: 'Sticker' })

      for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
        if (CASHED_LISTINGS.has(listingId)) continue

        const currentListing = steam.listinginfo[listingId]
        const link = currentListing.asset.market_actions[0].link

        const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))
        const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)

        CASHED_LISTINGS.add(listingId)

        try {
          const response = await getIPInspectItemInfo({ url: inspectLink })
          await sleep(1_000)

          const stickerTotalPrice = (response.iteminfo?.stickers || []).reduce(
            (acc, { wear, name }) => (wear === null ? acc + (STICKER_PRICES.get(`Sticker | ${name}`) ?? 0) : acc),
            0
          )

          console.log(`|___ ${listingId} $${stickerTotalPrice.toFixed(2)}`)

          if (stickerTotalPrice < 20) {
            continue
          }

          const goods = await getMarketGoods({ search: market_hash_name })
          const goods_id = goods.data.items.find((el) => el.market_hash_name === market_hash_name)?.id

          if (!goods_id) {
            continue
          }

          const goodsInfo = await getGoodsInfo({ goods_id })
          const referencePrice = Number(goodsInfo.data.goods_info.goods_ref_price)

          if (referencePrice + stickerTotalPrice * 0.11 < price) {
            continue
          }

          await sendMessage(
            generateSteamMessage({
              id: goods_id,
              price: price,
              name: market_hash_name,
              float: response.iteminfo.floatvalue,
              stickers: response.iteminfo?.stickers || [],
              stickerTotal: stickerTotalPrice,
              referencePrice: referencePrice,
              position: index + 1,
              filter: 'Sticker',
            })
          )
        } catch (error) {
          console.log(format(new Date(), 'HH:mm:ss'), error.message)
        }
      }
    }

    SEARCH_MARKET_DATA[market_hash_name] = steam.total_count
  } catch (error) {
    console.log(format(new Date(), 'HH:mm:ss'), 'STEAM_MARKET_SEARCH_ERROR')
  }
}

;(async () => {
  const pages = Array.from({ length: 110 }, (_, i) => i + 1)

  for (const page_num of pages) {
    const goods = await getBuff163MarketGoods({
      page_num,
      category_group: 'sticker',
      sort_by: 'price.desc',
    })
    for (const item of goods.data.items) {
      const market_hash_name = item.market_hash_name
      const price = Number((Number(item.sell_min_price) * 0.1375).toFixed(2))
      console.log(page_num, market_hash_name, price, item.sell_num)
      STICKER_PRICES.set(market_hash_name, price)
    }
    if (goods.data.items.length !== 50) break
    await sleep(4_000)
  }

  do {
    await Promise.allSettled(
      MARKET_HASH_NAMES.map((name) => {
        return limiter.schedule(() => findSteamItemInfo(name))
      })
    )

    await sleep(15_000) // Sleep 50s between requests

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
