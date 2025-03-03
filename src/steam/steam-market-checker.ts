import 'dotenv/config'

import { format } from 'date-fns'
import { getVercelMarketRender, getVercelSearchMarketRender } from '../api/versel'
import { sendMessage } from '../api/telegram'
import { MapSteamMarketRenderResponse, SearchMarketRenderItem } from '../types'
import { readFileSync } from 'fs'
import path from 'path'
import { getCSFloatItemInfo, getCSFloatListings } from '../api/csfloat'
import { isStickerCombo } from './utils'
import { getSteamUrl, sleep } from '../utils'
import axios from 'axios'

const CASHED_LISTINGS = new Set<string>()
const GOODS_CACHE: Record<string, { price: number; listings: number }> = {}
const FLOAT_BASE_PRICES = new Map<string, number>()

const pathname = path.join(__dirname, '../../csfloat.json')
const stickerData: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

const marketSearchHandler = async (config: { start: number; count: number; proxy: string }) => {
  const response: SearchMarketRenderItem[] = await getVercelSearchMarketRender(config)

  for (const item of response) {
    const now = format(new Date(), 'HH:mm:ss')
    const market_hash_name = item.marketHashName

    if (
      item.sellListings >= 500 ||
      market_hash_name.includes('CZ75-Auto') ||
      (market_hash_name.includes('AK-47 | Slate') && !market_hash_name.includes('StatTrak')) ||
      (market_hash_name.includes('AK-47 | Ice Coaled') && !market_hash_name.includes('StatTrak')) ||
      (market_hash_name.includes('Legion of Anubis') && !market_hash_name.includes('StatTrak'))
    ) {
      continue
    }

    if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].listings < item.sellListings) {
      console.log(`${now} ${market_hash_name} ${GOODS_CACHE[market_hash_name].listings} -> ${item.sellListings}`)
    }

    if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].listings < item.sellListings) {
      try {
        const steamMarketResponse: MapSteamMarketRenderResponse[] = await getVercelMarketRender({
          market_hash_name,
          proxy: config.proxy,
          filter: 'Sticker',
        })

        for (const [index, item] of steamMarketResponse.entries()) {
          const stickerTotal = item.stickers.reduce((acc, name) => acc + (stickerData[`Sticker | ${name}`] ?? 0), 0)

          if (!item.price || CASHED_LISTINGS.has(item.listingId)) {
            continue
          }

          if (stickerTotal > 25) {
            if (!FLOAT_BASE_PRICES.has(market_hash_name)) {
              try {
                const floatResponse = await getCSFloatListings({ market_hash_name })

                for (const data of floatResponse.data) {
                  for (const sticker of data.item?.stickers ?? []) {
                    if (sticker.reference?.price && sticker.name.includes('Sticker')) {
                      const price = Number((sticker.reference.price / 100).toFixed(2))
                      if (price >= 0.5) stickerData[sticker.name] = price
                    }
                  }
                }

                FLOAT_BASE_PRICES.set(market_hash_name, floatResponse.data[0].reference.predicted_price / 100)
              } catch (error) {
                const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message : error.message
                console.log(errorMessage)
                await sendMessage(errorMessage)
                process.exit(1)
              }
            }

            const basePrice = FLOAT_BASE_PRICES.get(market_hash_name) ?? 0
            const SP = ((item.price - basePrice) / stickerTotal) * 100

            console.log(`|___ ${market_hash_name} ST: $${stickerTotal.toFixed(2)}; SP: ${SP.toFixed(2)}%;`)

            if (SP < (isStickerCombo(item.stickers) ? 15 : 8)) {
              const itemInfoResponse = await getCSFloatItemInfo({ url: item.inspectUrl })

              const message: string[] = []

              message.push(
                `<a href="${getSteamUrl(market_hash_name, item.stickers)}">${market_hash_name}</a> | #${index + 1}\n\n`
              )

              for (const sticker of itemInfoResponse.iteminfo?.stickers ?? []) {
                const name = `Sticker | ${sticker.name}`
                message.push(
                  `<b>${name}</b>: ${sticker.wear === 0 ? '100%' : `${(sticker.wear * 100).toFixed(2)}% ($${stickerData[name] ?? 0})`}\n`
                )
              }
              message.push(`\n`)
              message.push(`<b>SP</b>: ${SP.toFixed(2)}%\n`)
              message.push(`<b>Steam price</b>: $${item.price}\n`)
              message.push(`<b>Reference price</b>: $${basePrice.toFixed(2)}\n`)
              message.push(`<b>Stickers total</b>: $${stickerTotal.toFixed(2)}\n\n`)
              message.push(`<b>Float</b>: ${itemInfoResponse.iteminfo.floatvalue}\n\n`)

              await sendMessage(message.join(''), undefined, process.env.TELEGRAM_STEAM_ALERTS)
            }
          }

          CASHED_LISTINGS.add(item.listingId)
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
        start: (i + 9) * 100 + num,
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
