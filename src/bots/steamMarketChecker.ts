import 'dotenv/config'

import { format } from 'date-fns'
import Bottleneck from 'bottleneck'
import { getMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { extractStickers, generateSteamMessage, sleep } from '../utils'
import { getMarketGoods, getGoodsInfo } from '../api/buff'
import UserAgent from 'user-agents'

const CASHED_LISTINGS = new Set<string>()

const limiter = new Bottleneck({ maxConcurrent: 3 })

const MARKET_HASH_NAMES = [
  {
    market_hash_name: 'AK-47 | Blue Laminate (Minimal Wear)',
    isSweet: (price: number, total: number) => price < 15 && total > 30,
    canSendToTelegram: false,
    userAgent: new UserAgent().toString(),
    proxy: null,
  },
  {
    market_hash_name: 'M4A1-S | Basilisk (Minimal Wear)',
    isSweet: (price: number, total: number) => price < 15 && total > 30,
    canSendToTelegram: false,
    userAgent: new UserAgent().toString(),
    proxy: 'http://05b8879f:4809862d7f@192.144.10.226:30013',
  },

  {
    market_hash_name: 'M4A4 | Temukau (Field-Tested)',
    isSweet: (price: number, total: number) => price < 15 && total > 30,
    canSendToTelegram: false,
    userAgent: new UserAgent().toString(),
    proxy: 'http://44379168:8345796691@192.144.9.27:30013',
  },
]

const getStickerDetails = async (stickers: string[]) => {
  const details: Record<string, number> = {}

  try {
    for (const sticker of [...new Set(stickers)]) {
      const market_hash_name = `Sticker | ${sticker}`

      const goods = await getMarketGoods({ search: market_hash_name })
      const goods_id = goods.data.items.find((el) => el.market_hash_name === market_hash_name)?.id

      if (goods_id) {
        const goodsInfo = await getGoodsInfo({ goods_id })
        details[sticker] = Number(goodsInfo.data.goods_info.goods_ref_price)
      }

      await sleep(1_000)
    }

    return details
  } catch (error) {
    console.log('BUFF.MARKET', error.message)

    return {}
  }
}

const findSteamItemInfo = async (
  config: {
    market_hash_name: string
    isSweet: (price: number, total: number) => boolean
    canSendToTelegram: boolean
    proxy: string | null
    userAgent: string
  },
  start: number = 0
) => {
  console.log(format(new Date(), 'HH:mm:ss'), config.market_hash_name, start)

  await sleep(25_000)

  try {
    const steam = await getMarketRender({
      proxy: config.proxy,
      userAgent: config.userAgent,
      market_hash_name: config.market_hash_name,
      start,
      count: 50,
    })

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      if (CASHED_LISTINGS.has(listingId)) continue

      const currentListing = steam.listinginfo[listingId]
      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))

      const assetInfo = steam.assets[730][currentListing.asset.contextid][currentListing.asset.id]
      const htmlDescription = assetInfo.descriptions.find((el) => el.value.includes('sticker_info'))?.value || ''

      const stickers = extractStickers(htmlDescription)

      if (stickers.length > 1 && config.canSendToTelegram) {
        const details = await getStickerDetails(stickers)

        await sendMessage(
          generateSteamMessage({
            price: price,
            name: config.market_hash_name,
            position: start + index + 1,
            stickers,
            details,
          })
        )
      }

      CASHED_LISTINGS.add(listingId)
    }
  } catch (error) {
    console.log(format(new Date(), 'HH:mm:ss'), 'STEAM_ERROR', error.message)
    await sleep(60_000 * 4)

    return
  }
}

;(async () => {
  do {
    await Promise.all(
      MARKET_HASH_NAMES.map((config) => {
        return limiter.schedule(() => findSteamItemInfo(config))
      })
    )

    MARKET_HASH_NAMES.forEach((_, index) => {
      MARKET_HASH_NAMES[index].canSendToTelegram = true
    })

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
