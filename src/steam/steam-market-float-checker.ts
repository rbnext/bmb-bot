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

            const response = await getCSFloatListings({
              market_hash_name,
              ...(market_hash_name.includes('Factory New') && { max_float: roundUp(itemFloatValue) }),
              ...(market_hash_name.includes('Minimal Wear') && { max_float: roundUp(itemFloatValue) }),
              ...(market_hash_name.includes('Field-Tested') && { max_float: roundUp(itemFloatValue) }),
            })

            const lowestPrice = response.data[0].price / 100
            const basePrice = response.data[0].reference.base_price / 100
            const filteredItemsByFloat = history.filter((i) => i.item.float_value < roundUp(itemFloatValue))

            const message: string[] = []
            message.push(
              `<a href="${getSteamUrl(market_hash_name, [])}">${market_hash_name}</a> | <a href="https://csfloat.com/search?market_hash_name=${market_hash_name}">FLOAT</a> | #${index + 1}\n\n`
            )
            message.push(`<b>Steam price</b>: $${item.price}\n`)
            message.push(`<b>Predicted price</b>: $${basePrice.toFixed(2)}\n`)
            message.push(`<b>Lowest price(max_float: ${roundUp(itemFloatValue)})</b>: $${lowestPrice.toFixed(2)}\n`)
            message.push(`<b>Float</b>: ${itemInfoResponse.iteminfo.floatvalue}\n\n`)

            if (filteredItemsByFloat.length !== 0) {
              message.push(`<b>History</b>:\n`)
              for (const [index, floatItem] of filteredItemsByFloat.entries()) {
                const float = floatItem.item.float_value.toFixed(10)
                const price = Number((floatItem.price / 100).toFixed(2))
                const stickerTotal = (floatItem.item.stickers ?? []).reduce(
                  (acc, cur) => acc + (cur.reference?.price ?? 0) / 100,
                  0
                )

                message.push(`<b>${index + 1}.</b> $${price} ${float} ($${stickerTotal})\n`)
              }
            }

            await sendMessage(message.join(''), undefined, process.env.TELEGRAM_STEAM_ALERTS)
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

;(async () => {
  do {
    for (const num of [-1, 0, 1]) {
      const configs = Array.from({ length: 10 }, (_, i) => ({
        proxy: `${process.env.PROXY}-${i + 1}`,
        start: (i + 15) * 100 + num,
        count: 100,
      }))

      await Promise.allSettled(configs.map(marketSearchHandler)).then((results) => {
        for (const result of results) {
          if (result.status !== 'fulfilled') console.log(result.status)
        }
      })
      await sleep(60_000 - 1_000)
    }

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
