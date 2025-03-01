import dotenv from 'dotenv'

dotenv.config()

import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { getSteamUrl, sleep } from '../utils'

import { getCSFloatItemInfo, getCSFloatListings } from '../api/csfloat'
import { MapSteamMarketRenderResponse } from '../types'
import { getVercelMarketRender } from '../api/versel'

const CASHED_LISTINGS = new Set<string>()

const configList1 = [
  {
    market_hash_name: 'StatTrak™ AK-47 | Redline (Field-Tested)',
    max_float: 0.25,
  },
  {
    market_hash_name: 'Glock-18 | Gold Toof (Minimal Wear)',
    max_float: 0.09,
  },
  {
    market_hash_name: 'Desert Eagle | Midnight Storm (Factory New)',
    max_float: 0.02,
  },
  {
    market_hash_name: 'Zeus x27 | Dragon Snore (Minimal Wear)',
    max_float: 0.08,
  },
]

const configList2 = [
  {
    market_hash_name: 'USP-S | Whiteout (Minimal Wear)',
    max_float: 0.09,
  },
  {
    market_hash_name: 'StatTrak™ M4A1-S | Nightmare (Minimal Wear)',
    max_float: 0.08,
  },
  {
    market_hash_name: 'Glock-18 | Gold Toof (Factory New)',
    max_float: 0.02,
  },
  {
    market_hash_name: 'Desert Eagle | Night (Minimal Wear)',
    max_float: 0.08,
  },
]

const configMapper = {
  1: configList1,
  2: configList2,
} as const

const listId = Number(process.env.LIST_ID) ?? 1
const configList = configMapper[listId as keyof typeof configMapper] || []

const init = async () => {
  do {
    for (const [index, config] of configList.entries()) {
      const market_hash_name = config.market_hash_name

      try {
        const steamMarketResponse: MapSteamMarketRenderResponse[] = await getVercelMarketRender({
          market_hash_name,
          proxy: `${process.env.STEAM_PROXY}${index + 1}`,
        })

        for (const [index, item] of steamMarketResponse.entries()) {
          if (!item.price || CASHED_LISTINGS.has(item.listingId)) continue

          const now = format(new Date(), 'HH:mm:ss')
          const itemInfoResponse = await getCSFloatItemInfo({ url: item.inspectUrl })
          const floatValue = Number(itemInfoResponse.iteminfo.floatvalue)

          console.log(now, market_hash_name, floatValue.toFixed(10), item.price)

          if (floatValue < config.max_float) {
            const response = await getCSFloatListings({ market_hash_name, max_float: config.max_float })
            const lowestPrice = response.data[0].price / 100
            const basePrice = response.data[0].reference.base_price / 100

            const message: string[] = []
            message.push(`<a href="${getSteamUrl(market_hash_name, [])}">${market_hash_name}</a> | #${index + 1}\n\n`)
            message.push(`<b>Steam price</b>: $${item.price}\n`)
            message.push(`<b>Base price</b>: $${basePrice.toFixed(2)}\n`)
            message.push(`<b>Lowest price(by float)</b>: $${lowestPrice.toFixed(2)}\n`)
            message.push(`<b>Float</b>: ${itemInfoResponse.iteminfo.floatvalue}\n\n`)
            await sendMessage(message.join(''), undefined, process.env.TELEGRAM_STEAM_ALERTS)
          }

          CASHED_LISTINGS.add(item.listingId)

          await sleep(2_000)
        }
      } catch (error) {
        console.log(format(new Date(), 'HH:mm:ss'), 'ERROR', error.message)
      } finally {
        await sleep(40_000 / configList.length)
      }
    }

    // eslint-disable-next-line no-constant-condition
  } while (true)
}

init()
