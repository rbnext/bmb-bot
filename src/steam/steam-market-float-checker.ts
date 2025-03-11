import 'dotenv/config'

import { format } from 'date-fns'
import { getVercelMarketRender, getVercelSearchMarketRender } from '../api/versel'
import { sendMessage } from '../api/telegram'
import { MapSteamMarketRenderResponse, SearchMarketRenderItem } from '../types'
import { getCSFloatItemInfo, getCSFloatListings, getMarketHashNameHistory } from '../api/csfloat'
import { getSteamUrl, sleep } from '../utils'
import path from 'path'
import { readFileSync } from 'fs'

const CASHED_LISTINGS = new Set<string>()
const GOODS_CACHE: Record<string, { price: number; listings: number }> = {}

const pathname = path.join(__dirname, '../../csfloat.json')
const stickerData: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

const roundUp = (num: number) => Math.ceil(num * 100) / 100

const marketSearchHandler = async (config: { start: number; count: number; proxy: string }) => {
  const response: SearchMarketRenderItem[] = await getVercelSearchMarketRender(config)

  for (const item of response) {
    const now = format(new Date(), 'HH:mm:ss')
    const market_hash_name = item.marketHashName

    if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].listings < item.sellListings) {
      console.log(`${now} ${market_hash_name} ${GOODS_CACHE[market_hash_name].listings} -> ${item.sellListings}`)
    }

    if (
      [
        'AK-47 | Cartel (Minimal Wear)',
        'AK-47 | Bloodsport (Field-Tested)',
        'AK-47 | The Empress (Field-Tested)',
        'AK-47 | Redline (Field-Tested)',
        'AK-47 | The Outsiders (Minimal Wear)',
        'Five-SeveN | Case Hardened (Factory New)',
        'M4A4 | 龍王 (Dragon King) (Minimal Wear)',
        'StatTrak™ M4A1-S | Black Lotus (Minimal Wear)',
        'StatTrak™ AWP | Chromatic Aberration (Minimal Wear)',
        'SSG 08 | Blood in the Water (Minimal Wear)',
        'Glock-18 | Dragon Tattoo (Factory New)',
      ].includes(market_hash_name) ||
      item.sellListings < 40
    ) {
      continue
    }

    if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].listings < item.sellListings) {
      try {
        const steamMarketResponse: MapSteamMarketRenderResponse[] = await getVercelMarketRender({
          market_hash_name,
          proxy: config.proxy,
        })

        const filteredSteamMarketResponse = steamMarketResponse.slice(0, 2)

        for (const [index, item] of filteredSteamMarketResponse.entries()) {
          if (!item.price || CASHED_LISTINGS.has(item.listingId)) {
            continue
          }

          const itemInfoResponse = await getCSFloatItemInfo({ url: item.inspectUrl })
          const itemFloatValue = Number(itemInfoResponse.iteminfo.floatvalue)

          console.log(`|___ ${market_hash_name} ${itemFloatValue.toFixed(10)}`)

          if (
            (market_hash_name.includes('Factory New') && itemFloatValue < 0.02) ||
            (market_hash_name.includes('Minimal Wear') && itemFloatValue < 0.09) ||
            (market_hash_name.includes('Field-Tested') && itemFloatValue < 0.18)
          ) {
            const history = await getMarketHashNameHistory({
              market_hash_name,
            })

            for (const data of history) {
              for (const sticker of data.item?.stickers ?? []) {
                if (sticker.reference?.price && sticker.name.includes('Sticker')) {
                  stickerData[sticker.name] = Number((sticker.reference.price / 100).toFixed(2))
                }
              }
            }

            const response = await getCSFloatListings({
              market_hash_name,
              ...(market_hash_name.includes('Factory New') && { max_float: roundUp(itemFloatValue) }),
              ...(market_hash_name.includes('Minimal Wear') && { max_float: roundUp(itemFloatValue) }),
              ...(market_hash_name.includes('Field-Tested') && { max_float: roundUp(itemFloatValue) }),
            })

            for (const data of response.data) {
              for (const sticker of data.item?.stickers ?? []) {
                if (sticker.reference?.price && sticker.name.includes('Sticker')) {
                  stickerData[sticker.name] = Number((sticker.reference.price / 100).toFixed(2))
                }
              }
            }

            const lowestPrice = response.data[0].price / 100
            const basePrice = response.data[0].reference.base_price / 100
            const stickers = itemInfoResponse.iteminfo?.stickers ?? []

            const filteredByFloatAndStickers = history.filter(({ item }) => {
              const st = (item.stickers ?? []).reduce((acc, { reference }) => acc + (reference?.price || 0), 0)
              return item.float_value < roundUp(itemFloatValue) && st < 1000
            })

            const message: string[] = []
            message.push(
              `<a href="${getSteamUrl(market_hash_name, [])}">${market_hash_name}</a> | <a href="https://csfloat.com/search?market_hash_name=${market_hash_name}">FLOAT</a> | #${index + 1}\n\n`
            )
            message.push(`<b>Steam price</b>: $${item.price}\n`)
            message.push(`<b>Predicted price</b>: $${basePrice.toFixed(2)}\n`)
            message.push(`<b>Lowest price(max_float: ${roundUp(itemFloatValue)})</b>: $${lowestPrice.toFixed(2)}\n`)
            message.push(`<b>Current float</b>: ${itemInfoResponse.iteminfo.floatvalue}\n\n`)

            for (const sticker of stickers) {
              const name = `Sticker | ${sticker.name}`
              const stickerPrice = stickerData[name] ?? 0
              message.push(`<b>${name}</b>: $${stickerPrice} ${sticker.wear === 0 ? '' : '❗'}\n`)
            }

            if (filteredByFloatAndStickers.length !== 0) {
              if (stickers.length !== 0) message.push('\n')
              for (const [index, floatItem] of filteredByFloatAndStickers.slice(0, 3).entries()) {
                const float = floatItem.item.float_value.toFixed(15)
                const price = Number((floatItem.price / 100).toFixed(2))
                message.push(`<b>${index + 1}.</b> ${float} $${price}\n`)
              }
            }

            await sendMessage({
              text: message.join(''),
              chat_id: process.env.TELEGRAM_STEAM_ALERTS,
            })
          }

          CASHED_LISTINGS.add(item.listingId)

          await sleep(500)
        }
      } catch (error) {
        console.log(format(new Date(), 'HH:mm:ss'), error.message)
      }
    }

    GOODS_CACHE[market_hash_name] = { price: item.sellPrice, listings: item.sellListings }
  }

  return config.proxy
}
