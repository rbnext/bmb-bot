import path from 'path'
import { readFileSync } from 'fs'
import { SteamDBItem, SteamMarketConfig } from '../types'
import { getGoodsInfo, getMarketGoods } from '../api/buff'
import { extractStickers, generateSteamMessage, sleep } from '../utils'
import { getMarketRender } from '../api/steam'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'

const pathname = path.join(__dirname, '../../buff.json')
const steam_db: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))

const CASHED_LISTINGS = new Set<string>()

export const getStickerDetails = async (stickers: string[]) => {
  const details: Record<string, number> = {}

  try {
    for (const sticker of [...new Set(stickers)]) {
      const market_hash_name = `Sticker | ${sticker}`

      if (steam_db[market_hash_name]) {
        details[sticker] = Number(steam_db[market_hash_name].reference_price)
      } else {
        const goods = await getMarketGoods({ search: market_hash_name })
        const goods_id = goods.data.items.find((el) => el.market_hash_name === market_hash_name)?.id

        if (goods_id) {
          const goodsInfo = await getGoodsInfo({ goods_id })
          details[sticker] = Number(goodsInfo.data.goods_info.goods_ref_price)
          console.log('-', market_hash_name)
        }

        await sleep(1_000)
      }
    }

    return details
  } catch (error) {
    console.log('BUFF.MARKET', error.message)

    return {}
  }
}

export const findSteamItemInfo = async (config: SteamMarketConfig, start: number = 0) => {
  try {
    const steam = await getMarketRender({
      proxy: config.proxy,
      userAgent: config.userAgent,
      market_hash_name: config.market_hash_name,
      start,
      count: 50,
    })

    if (!steam.success) {
      throw new Error('bad response')
    }

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      const position = start + index + 1

      const currentListing = steam.listinginfo[listingId]
      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))

      const link = currentListing.asset.market_actions[0].link
      const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)

      const referenceId = listingId + currentListing.asset.id

      const assetInfo = steam.assets[730][currentListing.asset.contextid][currentListing.asset.id]
      const htmlDescription = assetInfo.descriptions.find((el) => el.value.includes('sticker_info'))?.value || ''

      const stickers = extractStickers(htmlDescription)

      if (CASHED_LISTINGS.has(referenceId)) continue

      if (stickers.length !== 0 && config.canSendToTelegram) {
        const details = await getStickerDetails(stickers)

        const stickerTotalPrice = stickers.reduce((acc, name) => acc + (details[name] ?? 0), 0)

        console.log(
          format(new Date(), 'HH:mm:ss'),
          config.market_hash_name,
          `$${stickerTotalPrice.toFixed(2)}`,
          `#${position}`
        )

        if (price && stickerTotalPrice >= price) {
          await sendMessage(
            generateSteamMessage({
              price: price,
              name: config.market_hash_name,
              position,
              referencePrice: config.referencePrice,
              stickerTotal: stickerTotalPrice,
              inspectLink,
              stickers,
              details,
            })
          )
        }
      }

      CASHED_LISTINGS.add(referenceId)
    }
  } catch (error) {
    console.log('STEAM_ERROR', config.proxy, error.message)

    if (error.message.includes('canceled')) await sleep(5_000)
    else if (error.message.includes('bad response')) await sleep(10_000)
    else if (error.message.includes('status code 502')) await sleep(20_000)
    else await sleep(60_000 * 2)

    return
  }
}

export const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}
