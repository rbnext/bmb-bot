import 'dotenv/config'

import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { sleep } from '../utils'

import { MapSteamMarketRenderResponse } from '../types'
import { getVercelMarketRender } from '../api/versel'

const CASHED_LISTINGS = new Set<string>()

const isSweetDieCastAK = (pattern: number) => {
  if (
    (pattern >= 1 && pattern <= 5000) ||
    (pattern > 5000 && pattern <= 9000) ||
    (pattern >= 20000 && pattern <= 23000) ||
    (pattern > 23000 && pattern <= 25000) ||
    (pattern >= 90000 && pattern <= 94999) ||
    (pattern >= 95000 && pattern <= 98999) ||
    (pattern >= 99000 && pattern <= 99999)
  ) {
    return true
  }

  return false
}

const proxyList = Array.from({ length: 10 }, (_, i) => i + 1)

const init = async () => {
  do {
    for (const proxyId of proxyList) {
      const market_hash_name = 'Charm | Die-cast AK'

      try {
        const steamMarketResponse: MapSteamMarketRenderResponse[] = await getVercelMarketRender({
          market_hash_name,
          proxy: `${process.env.STEAM_PROXY}-${proxyId}`,
        })

        if (steamMarketResponse.length === 0 || !Array.isArray(steamMarketResponse)) {
          throw new Error('No items found')
        }

        for (const [index, item] of steamMarketResponse.entries()) {
          if (!item.pattern || CASHED_LISTINGS.has(item.listingId)) continue

          const now = format(new Date(), 'HH:mm:ss')
          console.log(now, market_hash_name, item.pattern, item.price)

          if (isSweetDieCastAK(item.pattern)) {
            const message: string[] = []
            message.push(
              `<a href="https://steamcommunity.com/market/listings/730/${encodeURIComponent(market_hash_name)}?filter=Charm Template: ${item.pattern}">${market_hash_name}</a> | #${index + 1}\n\n`
            )
            message.push(`<b>Steam price</b>: $${item.price ? item.price : 'Sold!'}\n`)
            message.push(`<b>Charm template</b>: #${item.pattern}\n`)
            await sendMessage(message.join(''))
          }

          CASHED_LISTINGS.add(item.listingId)
        }
      } catch (error) {
        console.log(format(new Date(), 'HH:mm:ss'), 'ERROR', error.message)
      } finally {
        await sleep(2_500)
      }
    }
    // eslint-disable-next-line no-constant-condition
  } while (true)
}

init()
