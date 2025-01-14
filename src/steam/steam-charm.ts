import 'dotenv/config'

import { format } from 'date-fns'
import { getMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { getRandomNumber, sleep } from '../utils'
import { getInspectLink } from './utils'

import { getCSFloatItemInfo } from '../api/csfloat'

const CASHED_LISTINGS = new Set<string>()

const findSteamItemInfo = async ({ market_hash_name, proxy }: { market_hash_name: string; proxy: string }) => {
  try {
    const steam = await getMarketRender({ market_hash_name, proxy, count: getRandomNumber(10, 50) })

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      if (CASHED_LISTINGS.has(listingId)) continue

      const currentListing = steam.listinginfo[listingId]

      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))

      const link = currentListing.asset.market_actions[0].link
      const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)

      const assetInfo = steam.assets[730][currentListing.asset.contextid][currentListing.asset.id]
      const template = assetInfo.descriptions.find((el) => el.value.includes('Charm Template'))?.value || ''

      let pattern = template ? Number(template.match(/\d+/g)) : null

      if (pattern === null) {
        try {
          await getCSFloatItemInfo({ url: inspectLink }).then((response) => {
            pattern = response.iteminfo?.keychains?.[0]?.pattern ?? null
          })
        } catch (error) {
          await sendMessage(`Failed to retrieve the pattern for the ${market_hash_name} item.`)
        } finally {
          await sleep(3_000)
        }
      }

      if (!price || !pattern) {
        console.log(
          `Failed to get price or pattern. Current price: ${price ?? 'unknown'}. Pattern: ${pattern ?? 'unknown'}`
        )
        CASHED_LISTINGS.add(listingId)

        continue
      }

      console.log(format(new Date(), 'HH:mm:ss'), market_hash_name, pattern)

      if (
        (pattern >= 1 && pattern <= 5000 && price <= 15) ||
        (pattern > 5000 && pattern <= 9000 && price <= 10) ||
        (pattern >= 20000 && pattern <= 23000 && price <= 17) ||
        (pattern > 23000 && pattern <= 25000 && price <= 10) ||
        (pattern >= 90000 && pattern <= 94999 && price <= 8) ||
        (pattern >= 95000 && pattern <= 98999 && price <= 12) ||
        (pattern >= 99000 && pattern <= 99999 && price <= 20)
      ) {
        await sendMessage(`${market_hash_name}. Price: $${price}. Pattern: #${pattern}`)
      }

      CASHED_LISTINGS.add(listingId)
    }
  } catch (error) {
    console.log(format(new Date(), 'HH:mm:ss'), error.message)

    if (error.message?.includes('429')) await sleep(60_000 * 2)
  }
}

;(async () => {
  const STEAM_PROXY = String(process.env.STEAM_PROXY).trim().split(';')

  console.log('STEAM_PROXY', STEAM_PROXY)

  do {
    for (const proxy of STEAM_PROXY) {
      await findSteamItemInfo({ market_hash_name: 'Charm | Die-cast AK', proxy }).then(() =>
        sleep(40_000 / STEAM_PROXY.length)
      )
    }

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
