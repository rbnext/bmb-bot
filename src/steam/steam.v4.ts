import dotenv from 'dotenv'

dotenv.config()

import { format } from 'date-fns'
import { stemMarketBuyListing } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { extractStickers, getSteamUrl, sleep } from '../utils'
import { getInspectLink, isStickerCombo } from './utils'

import { getCSFloatItemInfo, getCSFloatListings } from '../api/csfloat'
import { SearchMarketRender, SteamMarketRender } from '../types'
import { WatchEventType, readFileSync, watch, writeFileSync } from 'fs'
import path from 'path'
import { getVercelMarketRender, getVercelSearchMarketRender } from '../api/versel'

watch('.env', (eventType: WatchEventType) => {
  if (eventType === 'change') dotenv.config()
})

const CASHED_LISTINGS = new Set<string>()
const GOODS_CACHE: Record<string, { price: number; listings: number }> = {}

const pathname = path.join(__dirname, '../../csfloat.json')
const stickerData: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

const findSteamItemInfo = async ({ market_hash_name, proxy }: { market_hash_name: string; proxy: string }) => {
  let basePrice: number = 0

  try {
    const steam: SteamMarketRender = await getVercelMarketRender({ market_hash_name, proxy, filter: 'Sticker' })

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      if (CASHED_LISTINGS.has(listingId)) continue

      const now = format(new Date(), 'HH:mm:ss')
      const currentListing = steam.listinginfo[listingId]
      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))

      const assetInfo = steam.assets[730][currentListing.asset.contextid][currentListing.asset.id]
      const htmlDescription = assetInfo.descriptions.find((el) => el.value.includes('sticker_info'))?.value || ''

      const link = currentListing.asset.market_actions[0].link
      const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)

      const stickers = extractStickers(htmlDescription)

      const stickerTotal = stickers.reduce((acc, name) => acc + (stickerData[`Sticker | ${name}`] ?? 0), 0)

      if (!price && stickerTotal !== 0) {
        console.log(`|___ Sold! ST: $${stickerTotal.toFixed(2)}; Combo: ${String(isStickerCombo(stickers))}`)
        CASHED_LISTINGS.add(listingId)

        continue
      }

      if (stickerTotal > 15) {
        if (basePrice === 0) {
          try {
            const floatResponse = await getCSFloatListings({ market_hash_name })

            const pathname = path.join(__dirname, '../../csfloat-temp.json')
            const stickerData: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

            for (const data of floatResponse.data) {
              for (const sticker of data.item?.stickers ?? []) {
                if (sticker.reference?.price && sticker.name.includes('Sticker')) {
                  const price = Number((sticker.reference.price / 100).toFixed(2))
                  if (price >= 0.05) stickerData[sticker.name] = price
                }
              }
            }

            basePrice = floatResponse.data[0].reference.base_price / 100
            writeFileSync(pathname, JSON.stringify({ ...stickerData }, null, 4))
          } catch (error) {
            await sendMessage(`Failed to retrieve the price for the ${market_hash_name} item.`)
          }
        }

        const SP = ((price - basePrice) / stickerTotal) * 100

        console.log(
          `|___ ST: $${stickerTotal.toFixed(2)}; SP: ${SP.toFixed(2)}%; Combo: ${String(isStickerCombo(stickers))}`
        )

        if (SP < (isStickerCombo(stickers) ? 18 : 8)) {
          const itemInfoResponse = await getCSFloatItemInfo({ url: inspectLink })

          const message: string[] = []

          message.push(
            `<a href="${getSteamUrl(market_hash_name, stickers)}">${market_hash_name}</a> | #${index + 1}\n\n`
          )

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

          const sentMessage = await sendMessage(message.join(''))

          if (price && price <= 20 && (itemInfoResponse.iteminfo.stickers || [])?.every((item) => item.wear === 0)) {
            try {
              const response = await stemMarketBuyListing({
                idListing: currentListing.listingid,
                market_hash_name: market_hash_name,
                converted_price: currentListing.converted_price,
                converted_fee: currentListing.converted_fee,
              })

              if (response?.wallet_info?.success === 1) {
                await sendMessage('Success purchase', sentMessage.result.message_id)
              } else {
                await sendMessage('Failed purchase', sentMessage.result.message_id)
              }

              console.log(response)
            } catch (error) {
              console.log(error)
              await sendMessage(`Steam failed to purchase the ${market_hash_name} item.`)
            }
          }
        }

        await sleep(3_000)
      }

      CASHED_LISTINGS.add(listingId)
    }
  } catch (error) {
    console.log(format(new Date(), 'HH:mm:ss'), 'STEAM_ERROR', error.message)

    if (error.message?.includes('403')) await sleep(60_000 * 2)
    if (error.message?.includes('canceled')) await sleep(60_000)
  }
}

;(async () => {
  const STEAM_PROXY = String(process.env.STEAM_PROXY).trim().split(';')
  const STEAM_SEARCH_START = Number(process.env.STEAM_SEARCH_START)

  console.log('STEAM_PROXY', STEAM_PROXY)
  console.log('STEAM_SEARCH_START', STEAM_SEARCH_START)

  let start = STEAM_SEARCH_START - 2

  do {
    let count = 100 - STEAM_PROXY.length + 1

    for (const proxy of STEAM_PROXY) {
      try {
        const response: SearchMarketRender = await getVercelSearchMarketRender({
          query: 'Sticker',
          quality: ['tag_strange', 'tag_normal'],
          proxy,
          start,
          count,
        })
        for (const item of response.results) {
          const now = format(new Date(), 'HH:mm:ss')
          const market_hash_name = item.asset_description.market_hash_name
          if (['AK-47 | Redline (Field-Tested)', 'AK-47 | Slate (Field-Tested)'].includes(market_hash_name)) continue

          if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].listings !== item.sell_listings) {
            console.log(`${now} ${market_hash_name} ${GOODS_CACHE[market_hash_name].listings} -> ${item.sell_listings}`)
          }
          if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].listings < item.sell_listings) {
            await findSteamItemInfo({ market_hash_name, proxy })
          }
          GOODS_CACHE[market_hash_name] = { price: item.sell_price, listings: item.sell_listings }
        }
      } catch (error) {
        console.log(error.message)

        if (error.message?.includes('403')) await sleep(60_000 * 2)
        if (error.message?.includes('canceled')) await sleep(60_000)
      } finally {
        await sleep(60_000 / STEAM_PROXY.length)

        count++
      }
    }

    if (STEAM_SEARCH_START === start) start = STEAM_SEARCH_START - 2
    else start++

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
