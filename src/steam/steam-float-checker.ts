import dotenv from 'dotenv'

dotenv.config()

import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { getSteamUrl, sleep } from '../utils'
import { getInspectLink, mapSteamMarketRenderResponse } from './utils'

import { getCSFloatItemInfo, getCSFloatListings } from '../api/csfloat'
import { SearchMarketRender, SteamMarketRender } from '../types'
import { getVercelMarketRender, getVercelSearchMarketRender } from '../api/versel'
import { MARKET_BLACK_LIST } from './config'

const CASHED_LISTINGS = new Set<string>()
const GOODS_CACHE: Record<string, { price: number; listings: number }> = {}

const configList = [
  {
    market_hash_name: 'AK-47 | Redline (Field-Tested)',
    isSweet: (float: number) => float < 0.18,
  },

  {
    market_hash_name: 'M4A1-S | Black Lotus (Factory New)',
    isSweet: (float: number) => float < 0.02,
  },
  {
    market_hash_name: 'USP-S | Jawbreaker (Factory New)',
    isSweet: (float: number) => float < 0.02,
  },
]

const init = async () => {
  const STEAM_PROXY = String(process.env.STEAM_PROXY).trim()
  const STEAM_SEARCH_START = Number(process.env.STEAM_SEARCH_START)

  console.log('STEAM_PROXY', STEAM_PROXY)
  console.log('STEAM_SEARCH_START', STEAM_SEARCH_START)

  try {
    do {
      for (const [index, config] of configList.entries()) {
        const market_hash_name = config.market_hash_name

        const response: SteamMarketRender = await getVercelMarketRender({
          count: 3,
          market_hash_name,
          proxy: `${STEAM_PROXY}${index + 1}`,
        })

        const steamMarketResponse = mapSteamMarketRenderResponse(response)

        for (const item of steamMarketResponse) {
          const itemInfoResponse = await getCSFloatItemInfo({ url: item.inspectUrl })
          const floatValue = Number(itemInfoResponse.iteminfo.floatvalue)

          if (config.isSweet(floatValue)) {
            const response = await getCSFloatListings({
              market_hash_name,
              ...(market_hash_name.includes('Factory New') && { max_float: 0.02 }),
              ...(market_hash_name.includes('Minimal Wear') && { max_float: 0.08 }),
              ...(market_hash_name.includes('Field-Tested') && { max_float: 0.18 }),
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

        await sleep(60_000 / configList.length)
      }

      // eslint-disable-next-line no-constant-condition
    } while (true)
  } catch (error) {
    console.log(format(new Date(), 'HH:mm:ss'), 'STEAM_ERROR', error.message)

    if (error.message?.includes('403')) await sleep(60_000 * 2)
    if (error.message?.includes('401')) await sleep(60_000 * 2)
    if (error.message?.includes('canceled')) await sleep(60_000)
  }

  init()
}

init()
