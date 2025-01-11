import 'dotenv/config'

import { format } from 'date-fns'
import { getMarketRender, getSearchMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { extractStickers, getSteamUrl, sleep } from '../utils'
import { getInspectLink, isStickerCombo } from './utils'

import { getCSFloatItemInfo, getCSFloatListings } from '../api/csfloat'
import { SearchMarketRender } from '../types'
import { readFileSync } from 'fs'
import path from 'path'

const CASHED_LISTINGS = new Set<string>()
const GOODS_CACHE: Record<string, { price: number; listings: number }> = {}

const pathname = path.join(__dirname, '../../csfloat.json')
const stickerData: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

const findSteamItemInfo = async ({ market_hash_name }: { market_hash_name: string }) => {
  try {
    const steam = await getMarketRender({ market_hash_name, filter: 'Sticker' })

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      if (CASHED_LISTINGS.has(listingId)) continue

      const currentListing = steam.listinginfo[listingId]
      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))

      const assetInfo = steam.assets[730][currentListing.asset.contextid][currentListing.asset.id]
      const htmlDescription = assetInfo.descriptions.find((el) => el.value.includes('sticker_info'))?.value || ''

      const link = currentListing.asset.market_actions[0].link
      const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)

      const stickers = extractStickers(htmlDescription)

      const stickerTotal = stickers.reduce((acc, name) => acc + (stickerData[`Sticker | ${name}`] ?? 0), 0)

      console.log(format(new Date(), 'HH:mm:ss'), market_hash_name, stickerTotal.toFixed(2))

      if (stickerTotal > 10) {
        const response = await getCSFloatListings({ market_hash_name })

        const basePrice = response.data[0].reference.base_price / 100
        const SP = ((price - basePrice) / stickerTotal) * 100

        console.log(format(new Date(), 'HH:mm:ss'), 'SP', SP.toFixed(2) + '%')

        if (SP < (isStickerCombo(stickers) ? 18 : 8)) {
          const itemInfoResponse = await getCSFloatItemInfo({ url: inspectLink })

          const message: string[] = []

          message.push(`<a href="${getSteamUrl(market_hash_name)}">${market_hash_name}</a> | #${index + 1}\n\n`)

          for (const sticker of itemInfoResponse.iteminfo?.stickers ?? []) {
            const name = `Sticker | ${sticker.name}`
            message.push(
              `<b>${name}</b>: ${sticker.wear === 0 ? '100%' : `${(sticker.wear * 100).toFixed(2)}% ($${stickerData[name] ?? 0})`}\n`
            )
          }
          message.push(`\n`)
          message.push(`<b>SP</b>: ${SP.toFixed(2)}%\n`)
          message.push(`<b>Steam price</b>: $${price}\n`)
          message.push(`<b>Reference price</b>: $${basePrice.toFixed(2)}\n`)
          message.push(`<b>Stickers total</b>: $${stickerTotal.toFixed(2)}\n\n`)
          message.push(`<b>Float</b>: ${itemInfoResponse.iteminfo.floatvalue}\n\n`)

          await sendMessage(message.join(''))
        }
      }

      CASHED_LISTINGS.add(listingId)
    }
  } catch (error) {
    console.log(format(new Date(), 'HH:mm:ss'), 'STEAM_ERROR', error.message)

    return
  }
}

;(async () => {
  let hasMarketUpdated: boolean = false

  const STEAM_SEARCH_START = Number(process.env.STEAM_SEARCH_START)

  console.log('STEAM_SEARCH_START', STEAM_SEARCH_START)

  do {
    try {
      const response: SearchMarketRender = await getSearchMarketRender({
        query: 'Sticker',
        quality: ['tag_normal'],
        start: STEAM_SEARCH_START,
      })

      for (const item of response.results) {
        const market_hash_name = item.asset_description.market_hash_name

        if (item.sell_listings >= 40) {
          if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].price !== item.sell_price) {
            hasMarketUpdated = true
          }

          if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].price > item.sell_price) {
            await findSteamItemInfo({ market_hash_name })
          }
        } else {
          if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].listings !== item.sell_listings) {
            hasMarketUpdated = true
          }

          if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].listings < item.sell_listings) {
            console.log(market_hash_name, GOODS_CACHE[market_hash_name].listings, '->', item.sell_listings)
            await findSteamItemInfo({ market_hash_name })
          }
        }

        GOODS_CACHE[market_hash_name] = { price: item.sell_price, listings: item.sell_listings }
      }
    } catch (error) {
      console.log(error.message)
    } finally {
      await sleep(hasMarketUpdated ? 170_000 : 20_000)
      hasMarketUpdated = false
    }

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
