import dotenv from 'dotenv'

dotenv.config()

import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { getSteamUrl, sleep } from '../utils'
import { mapSteamMarketRenderResponse } from './utils'

import { SteamMarketRender } from '../types'
import { getVercelMarketRender } from '../api/versel'

const CASHED_LISTINGS = new Set<string>()

const isDieCastAKSweet = (pattern: number, price: number) => {
  if (
    (pattern >= 1 && pattern <= 5000 && price <= 15) ||
    (pattern > 5000 && pattern <= 9000 && price <= 10) ||
    (pattern >= 20000 && pattern <= 23000 && price <= 17) ||
    (pattern > 23000 && pattern <= 25000 && price <= 10) ||
    (pattern >= 90000 && pattern <= 94999 && price <= 8) ||
    (pattern >= 95000 && pattern <= 98999 && price <= 12) ||
    (pattern >= 99000 && pattern <= 99999 && price <= 20)
  ) {
    return true
  }

  return false
}

const configList = [
  {
    market_hash_name: 'Charm | Die-cast AK',
    isSweet: isDieCastAKSweet,
    start: 0,
  },
  {
    market_hash_name: 'Charm | Die-cast AK',
    isSweet: isDieCastAKSweet,
    start: 100,
  },
  {
    market_hash_name: 'Charm | Die-cast AK',
    isSweet: isDieCastAKSweet,
    start: 200,
  },
  {
    market_hash_name: 'Charm | Die-cast AK',
    isSweet: isDieCastAKSweet,
    start: 300,
  },
]

const init = async () => {
  try {
    do {
      for (const [index, config] of configList.entries()) {
        const market_hash_name = config.market_hash_name

        const response: SteamMarketRender = await getVercelMarketRender({
          market_hash_name,
          proxy: `${process.env.STEAM_PROXY}${index + 1}`,
          count: 100,
        })

        const steamMarketResponse = mapSteamMarketRenderResponse(response)

        for (const item of steamMarketResponse) {
          if (!item.price || !item.pattern || CASHED_LISTINGS.has(item.listingId)) continue

          const now = format(new Date(), 'HH:mm:ss')
          console.log(now, market_hash_name, item.pattern, item.price)

          if (config.isSweet(item.pattern, item.price)) {
            const message: string[] = []
            message.push(
              `<a href="${getSteamUrl(market_hash_name, [])}">${market_hash_name}</a> | #${config.start + item.position}\n\n`
            )
            message.push(`<b>Steam price</b>: $${item.price}\n`)
            message.push(`<b>Charm template</b>: #${item.pattern}\n`)
            await sendMessage(message.join(''))
          }

          CASHED_LISTINGS.add(item.listingId)

          await sleep(2_000)
        }

        await sleep(40_000 / configList.length)
      }

      // eslint-disable-next-line no-constant-condition
    } while (true)
  } catch (error) {
    console.log(format(new Date(), 'HH:mm:ss'), 'ERROR', error.message)

    if (error.message?.includes('403')) await sleep(60_000 * 2)
    if (error.message?.includes('401')) await sleep(60_000 * 2)
    if (error.message?.includes('canceled')) await sleep(60_000)
  }

  init()
}

init()
