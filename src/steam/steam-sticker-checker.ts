import 'dotenv/config'

import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { isStickerCombo } from './utils'

import { getCSFloatItemInfo, getCSFloatListings } from '../api/csfloat'
import { MapSteamMarketRenderResponse } from '../types'
import { readFileSync } from 'fs'
import path from 'path'
import { getVercelMarketRender } from '../api/versel'
import { getSteamUrl, sleep } from '../utils'
import { configList1, configList2, configList3, configList4 } from './config'

const CASHED_LISTINGS = new Set<string>()

const configMapper = {
  1: configList1,
  2: configList2,
  3: configList3,
  4: configList4,
} as const

const listId = Number(process.env.LIST_ID)
const configList = configMapper[listId as keyof typeof configMapper] || []
const marketPrices = new Map<string, number>()

const pathname = path.join(__dirname, '../../csfloat.json')
const stickerData: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

const init = async () => {
  do {
    for (const config of configList) {
      const market_hash_name = config.market_hash_name

      try {
        const steamMarketResponse: MapSteamMarketRenderResponse[] = await getVercelMarketRender({
          market_hash_name,
          proxy: `${process.env.PROXY}-${config.proxyId}`,
          filter: 'Sticker',
        })

        for (const [index, item] of steamMarketResponse.entries()) {
          const stickerTotal = item.stickers.reduce((acc, name) => acc + (stickerData[`Sticker | ${name}`] ?? 0), 0)

          if (!item.price || CASHED_LISTINGS.has(item.listingId)) {
            continue
          }

          const now = format(new Date(), 'HH:mm:ss')
          console.log(now, market_hash_name, item.price, stickerTotal.toFixed(2))

          if (stickerTotal > 15) {
            if (!marketPrices.has(market_hash_name)) {
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

                marketPrices.set(market_hash_name, floatResponse.data[0].reference.base_price / 100)
              } catch (error) {
                await sendMessage({ text: `Failed to retrieve the price for the ${market_hash_name} item.` })
              }
            }

            const basePrice = marketPrices.get(market_hash_name) ?? 0
            const SP = ((item.price - basePrice) / stickerTotal) * 100

            console.log(
              `|___ ST: $${stickerTotal.toFixed(2)}; SP: ${SP.toFixed(2)}%; Combo: ${String(isStickerCombo(item.stickers))}`
            )

            if (SP < (isStickerCombo(item.stickers) ? 25 : 10)) {
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

              await sendMessage({ text: message.join('') })
            }

            await sleep(2_000)
          }

          CASHED_LISTINGS.add(item.listingId)
        }
      } catch (error) {
        console.log(format(new Date(), 'HH:mm:ss'), 'ERROR', error.message)

        if (error.message?.includes('403')) await sleep(60_000 * 2)
        if (error.message?.includes('401')) await sleep(60_000 * 2)
        if (error.message?.includes('canceled')) await sleep(60_000)
      } finally {
        await sleep(28_000 / (configList.length / 2))
      }
    }
    // eslint-disable-next-line no-constant-condition
  } while (true)
}

init()
