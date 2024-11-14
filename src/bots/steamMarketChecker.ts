import { format } from 'date-fns'
import { getInspectItemInfo } from '../api/pricempire'
import { getMarketRender } from '../api/steam'
import { sleep } from '../utils'

const CASHED_LISTINGS = new Set<string>()

const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}

export const steamMarketChecker = async () => {
  try {
    for (const market_hash_name of [
      'AK-47 | Redline (Field-Tested)',
      'M4A1-S | Black Lotus (Factory New)',
      'Desert Eagle | Conspiracy (Factory New)',
    ]) {
      const steam = await getMarketRender({ market_hash_name })

      for (const listingId of Object.keys(steam.listinginfo)) {
        const now = format(new Date(), 'HH:mm:ss')

        if (CASHED_LISTINGS.has(listingId)) continue

        const currentListing = steam.listinginfo[listingId]
        const link = currentListing.asset.market_actions[0].link

        const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))
        const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)

        try {
          const response = await getInspectItemInfo({ url: inspectLink })

          console.log(now, market_hash_name, price, response.iteminfo.floatvalue)
        } catch (error) {
          console.log(now, 'failed to get data for', inspectLink)
        }

        CASHED_LISTINGS.add(listingId)

        await sleep(1_000)
      }

      await sleep(50_000)
    }
  } catch (error) {
    console.log('error', error.message)

    return
  }

  await sleep(70_000)

  steamMarketChecker()
}

steamMarketChecker()
