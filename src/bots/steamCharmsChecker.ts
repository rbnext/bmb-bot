import 'dotenv/config'

import { format } from 'date-fns'
import { getMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { generateSteamMessage, sleep } from '../utils'

const CASHED_LISTINGS = new Set<string>()

const MARKET_HASH_NAMES = [
  {
    name: 'Charm | Die-cast AK',
    isSweet: (template: number) => template > 90000 || template < 27000,
  },
  {
    name: 'Charm | Titeenium AWP',
    isSweet: (template: number) => template > 93000,
  },
  {
    name: 'Charm | Semi-Precious',
    isSweet: (template: number) => template > 90000 || template < 10000,
  },
]

const findSteamItemInfo = async (
  market_hash_name: string,
  isSweet: (template: number) => boolean,
  start: number = 0
) => {
  console.log(format(new Date(), 'HH:mm:ss'), market_hash_name, start)

  await sleep(20_000)

  try {
    const steam = await getMarketRender({ market_hash_name, start, count: 100 })

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      if (CASHED_LISTINGS.has(listingId)) continue

      const currentListing = steam.listinginfo[listingId]
      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))

      const assetInfo = steam.assets[730][currentListing.asset.contextid][currentListing.asset.id]
      const template = assetInfo.descriptions.find((el) => el.value.includes('Charm Template'))?.value || ''

      const templateId = template ? Number(template.match(/\d+/g)) : null

      if (templateId && isSweet(templateId)) {
        await sendMessage(
          generateSteamMessage({ price: price, name: market_hash_name, position: start + index + 1, templateId })
        )
      }

      CASHED_LISTINGS.add(listingId)
    }

    if (start + 100 < steam.total_count) {
      await findSteamItemInfo(market_hash_name, isSweet, start + 100)
    }
  } catch (error) {
    console.log(format(new Date(), 'HH:mm:ss'), 'STEAM_ERROR', error.message)
    await sleep(60_000 * 5)

    return
  }
}

;(async () => {
  do {
    for (const config of MARKET_HASH_NAMES) {
      await findSteamItemInfo(config.name, config.isSweet)
    }

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
