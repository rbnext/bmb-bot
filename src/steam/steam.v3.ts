import 'dotenv/config'

import { format } from 'date-fns'
import { getMarketRender, getSearchMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { mapSteamMarketRenderResponse } from './utils'
import { isStickerCombo } from './utils'

import { getCSFloatItemInfo, getCSFloatListings } from '../api/csfloat'
import { SearchMarketRender, SteamMarketRender } from '../types'
import { readFileSync } from 'fs'
import path from 'path'
import { MARKET_BLACK_LIST } from './config'
import { getSteamUrl, sleep } from '../utils'

const CASHED_LISTINGS = new Set<string>()
const GOODS_CACHE: Record<string, { price: number; listings: number }> = {}

const pathname = path.join(__dirname, '../../csfloat.json')
const stickerData: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

const findSteamItemInfo = async ({ market_hash_name, proxy }: { market_hash_name: string; proxy: string }) => {
  let basePrice: number = 0

  try {
    const response: SteamMarketRender = await getMarketRender({
      proxy,
      market_hash_name,
      filter: 'Sticker',
    })

    const steamMarketResponse = mapSteamMarketRenderResponse(response)

    for (const item of steamMarketResponse) {
      if (!item.price || item.position > 1 || CASHED_LISTINGS.has(item.listingId)) continue

      const stickerTotal = item.stickers.reduce((acc, name) => acc + (stickerData[`Sticker | ${name}`] ?? 0), 0)

      if (stickerTotal < 10) continue

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

        basePrice = floatResponse.data[0].reference.base_price / 100
      } catch (error) {
        await sendMessage(`Failed to retrieve the price for the ${market_hash_name} item.`)
      }

      const SP = ((item.price - basePrice) / stickerTotal) * 100

      console.log(`|___ ST: $${stickerTotal.toFixed(2)}; SP: ${SP.toFixed(2)}%`)

      if (SP < (item.isStickerCombos ? 25 : 10)) {
        const itemInfoResponse = await getCSFloatItemInfo({ url: item.inspectUrl })

        const message: string[] = []

        message.push(
          `<a href="${getSteamUrl(market_hash_name, item.stickers)}">${market_hash_name}</a> | #${item.position}\n\n`
        )

        for (const sticker of itemInfoResponse.iteminfo?.stickers ?? []) {
          const name = `Sticker | ${sticker.name}`
          message.push(
            `<b>${name}</b>: ${sticker.wear === 0 ? '100%' : `${(sticker.wear * 100).toFixed(2)}% ($${stickerData[name] ?? 0})`}\n`
          )
        }
        if (itemInfoResponse.iteminfo?.stickers?.length !== 0) message.push(`\n`)
        for (const keychain of itemInfoResponse.iteminfo?.keychains ?? []) {
          message.push(`<b>Charm | ${keychain.name}</b>: ${keychain.pattern}\n`)
        }
        if (itemInfoResponse.iteminfo?.keychains?.length !== 0) message.push(`\n`)
        message.push(`<b>SP</b>: ${SP.toFixed(2)}%\n`)
        message.push(`<b>Steam price</b>: $${item.price}\n`)
        message.push(`<b>Reference price</b>: $${basePrice.toFixed(2)}\n`)
        message.push(`<b>Stickers total</b>: $${stickerTotal.toFixed(2)}\n\n`)
        message.push(`<b>Float</b>: ${itemInfoResponse.iteminfo.floatvalue}\n\n`)

        await sendMessage(message.join(''))
      }

      CASHED_LISTINGS.add(item.listingId)
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
        const response: SearchMarketRender = await getSearchMarketRender({
          query: 'Sticker',
          quality: ['tag_strange', 'tag_normal'],
          proxy,
          start,
          count,
        })
        for (const item of response.results) {
          const now = format(new Date(), 'HH:mm:ss')
          const market_hash_name = item.asset_description.market_hash_name
          if (MARKET_BLACK_LIST.includes(market_hash_name)) continue

          if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].price !== item.sell_price) {
            const current_price = (item.sell_price / 100).toFixed(2)
            const prev_price = (GOODS_CACHE[market_hash_name].price / 100).toFixed(2)
            console.log(`${now} ${market_hash_name} $${prev_price} -> $${current_price}`)
          }
          if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].price > item.sell_price) {
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
