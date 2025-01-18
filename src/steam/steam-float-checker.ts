import dotenv from 'dotenv'

dotenv.config()

import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { getSteamUrl, sleep } from '../utils'
import { getInspectLink } from './utils'

import { getCSFloatItemInfo, getCSFloatListings } from '../api/csfloat'
import { SearchMarketRender, SteamMarketRender } from '../types'
import { getVercelMarketRender, getVercelSearchMarketRender } from '../api/versel'
import { MARKET_BLACK_LIST } from './config'
import path from 'path'
import { readFileSync, writeFileSync } from 'fs'

const CASHED_LISTINGS = new Set<string>()
const GOODS_CACHE: Record<string, { price: number; listings: number }> = {}

const findSteamItemInfo = async ({ market_hash_name, proxy }: { market_hash_name: string; proxy: string }) => {
  try {
    const steam: SteamMarketRender = await getVercelMarketRender({ market_hash_name, proxy })

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      if (index >= 1 || CASHED_LISTINGS.has(listingId)) continue

      const currentListing = steam.listinginfo[listingId]
      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))
      const link = currentListing.asset.market_actions[0].link
      const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)
      const itemInfoResponse = await getCSFloatItemInfo({ url: inspectLink })
      const floatValue = Number(itemInfoResponse.iteminfo.floatvalue)

      if (!price) return

      console.log(`|___ Float: ${floatValue}`)

      const pathname = path.join(__dirname, '../../steam-temp.json')
      const steam: Record<string, number[]> = JSON.parse(readFileSync(pathname, 'utf8'))
      writeFileSync(
        pathname,
        JSON.stringify(
          {
            ...steam,
            [market_hash_name]: [price, ...(steam[market_hash_name] ?? [])],
          },
          null,
          4
        )
      )

      if (
        (market_hash_name.includes('Factory New') && floatValue < 0.02) ||
        (market_hash_name.includes('Minimal Wear') && floatValue < 0.08) ||
        (market_hash_name.includes('Field-Tested') && floatValue < 0.18)
      ) {
        const response = await getCSFloatListings({
          market_hash_name,
          ...(market_hash_name.includes('Factory New') && { max_float: 0.02 }),
          ...(market_hash_name.includes('Minimal Wear') && { max_float: 0.08 }),
          ...(market_hash_name.includes('Field-Tested') && { max_float: 0.18 }),
        })
        const lowestPrice = response.data[0].price / 100
        const basePrice = response.data[0].reference.base_price / 100

        const message: string[] = []
        message.push(`<a href="${getSteamUrl(market_hash_name, [])}">${market_hash_name}</a> | #${index + 1}\n\n`)
        message.push(`<b>Steam price</b>: $${price}\n`)
        message.push(`<b>Base price</b>: $${basePrice.toFixed(2)}\n`)
        message.push(`<b>Lowest price(by float)</b>: $${lowestPrice.toFixed(2)}\n`)
        message.push(`<b>Float</b>: ${itemInfoResponse.iteminfo.floatvalue}\n\n`)
        await sendMessage(message.join(''))
      }

      CASHED_LISTINGS.add(listingId)

      await sleep(2_000)
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
          quality: ['tag_normal'],
          exterior: ['tag_WearCategory0', 'tag_WearCategory1', 'tag_WearCategory2'],
          proxy,
          start,
          count,
        })
        for (const item of response.results) {
          const now = format(new Date(), 'HH:mm:ss')
          const market_hash_name = item.asset_description.market_hash_name
          if (MARKET_BLACK_LIST.includes(market_hash_name)) continue

          console.log((item.sell_price / 100).toFixed(2))

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
