import 'dotenv/config'

import { format } from 'date-fns'
import Bottleneck from 'bottleneck'
import { getMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { generateSteamMessage, sleep } from '../utils'
import { getIPInspectItemInfo } from '../api/pricempire'

const LOADED_ITEMS: Record<string, boolean> = {}
const CASHED_LISTINGS = new Set<string>()
const MIN_TREADS: number = 1

const limiter = new Bottleneck({ maxConcurrent: MIN_TREADS })

const MARKET_HASH_NAMES = ['MAC-10 | Silver (Factory New)']

const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}

const findSteamItemInfo = async (market_hash_name: string) => {
  try {
    const steam = await getMarketRender({ market_hash_name, start: 50, count: 100 })

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      if (CASHED_LISTINGS.has(listingId)) continue

      const currentListing = steam.listinginfo[listingId]
      const link = currentListing.asset.market_actions[0].link

      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))
      const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)

      try {
        const response = await getIPInspectItemInfo({ url: inspectLink })

        if (response.iteminfo.floatvalue < 0.01) {
          await sendMessage(
            generateSteamMessage({
              price: price,
              name: market_hash_name,
              float: response.iteminfo.floatvalue,
              stickers: response.iteminfo?.stickers || [],
              position: index + 1,
            })
          )
        }

        console.log(format(new Date(), 'HH:mm:ss'), market_hash_name, response.iteminfo.floatvalue)
      } catch (error) {
        console.log(format(new Date(), 'HH:mm:ss'), `ERROR: Failed to inspect item from pricempire.com`)
      }

      CASHED_LISTINGS.add(listingId)
    }
  } catch (error) {
    console.log(format(new Date(), 'HH:mm:ss'), 'STEAM_MARKET_SEARCH_ERROR')
  }
}

;(async () => {
  for (const name of MARKET_HASH_NAMES) LOADED_ITEMS[name] = false

  do {
    await Promise.allSettled(
      MARKET_HASH_NAMES.map((name) => {
        return limiter.schedule(() => findSteamItemInfo(name))
      })
    )

    await sleep(20_000) // Sleep 50s between requests

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
