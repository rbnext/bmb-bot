import dotenv from 'dotenv'

dotenv.config()

import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { getSteamUrl, sleep } from '../utils'
import { mapSteamMarketRenderResponse } from './utils'

import { getCSFloatItemInfo, getCSFloatListings } from '../api/csfloat'
import { SteamMarketRender } from '../types'
import { getVercelMarketRender } from '../api/versel'

const CASHED_LISTINGS = new Set<string>()

const configList = [
  {
    market_hash_name: 'M4A1-S | Black Lotus (Factory New)',
    isSweet: (float: number) => float < 0.02,
  },
  {
    market_hash_name: 'USP-S | Jawbreaker (Factory New)',
    isSweet: (float: number) => float < 0.02,
  },
  {
    market_hash_name: 'Glock-18 | Gold Toof (Minimal Wear)',
    isSweet: (float: number) => float < 0.09,
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
        })

        const steamMarketResponse = mapSteamMarketRenderResponse(response)

        for (const item of steamMarketResponse) {
          if (!item.price || CASHED_LISTINGS.has(item.listingId)) continue

          const now = format(new Date(), 'HH:mm:ss')
          const itemInfoResponse = await getCSFloatItemInfo({ url: item.inspectUrl })
          const floatValue = Number(itemInfoResponse.iteminfo.floatvalue)

          console.log(now, market_hash_name, floatValue, item.position)

          if (config.isSweet(floatValue)) {
            const response = await getCSFloatListings({
              market_hash_name,
              ...(market_hash_name.includes('Factory New') && { max_float: 0.02 }),
              ...(market_hash_name.includes('Minimal Wear') && { max_float: 0.09 }),
              ...(market_hash_name.includes('Field-Tested') && { max_float: 0.21 }),
            })
            const lowestPrice = response.data[0].price / 100
            const basePrice = response.data[0].reference.base_price / 100

            const message: string[] = []
            message.push(
              `<a href="${getSteamUrl(market_hash_name, [])}">${market_hash_name}</a> | #${item.position}\n\n`
            )
            message.push(`<b>Steam price</b>: $${item.price}\n`)
            message.push(`<b>Base price</b>: $${basePrice.toFixed(2)}\n`)
            message.push(`<b>Lowest price(by float)</b>: $${lowestPrice.toFixed(2)}\n`)
            message.push(`<b>Float</b>: ${itemInfoResponse.iteminfo.floatvalue}\n\n`)
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
