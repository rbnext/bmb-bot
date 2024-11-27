import 'dotenv/config'

import { format } from 'date-fns'
import { getMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { generateSteamMessage, sleep } from '../utils'
import { getBuff163GoodsSellOrder } from '../api/buff163'

const CASHED_LISTINGS = new Set<string>()

const MARKET_HASH_NAMES = [
  {
    goods_id: 968112,
    market_hash_name: 'Charm | Die-cast AK',
    isSweet: (template: number) => template > 90000 || template < 27000,
    canSendToTelegram: false,
  },
  {
    goods_id: 968082,
    market_hash_name: 'Charm | Titeenium AWP',
    isSweet: (template: number) => template > 93000,
    canSendToTelegram: false,
  },
  {
    goods_id: 968270,
    market_hash_name: 'Charm | Semi-Precious',
    isSweet: (template: number) => template > 90000 || template < 10000,
    canSendToTelegram: false,
  },
]

const findSteamItemInfo = async (
  config: {
    goods_id: number
    market_hash_name: string
    isSweet: (template: number) => boolean
    canSendToTelegram: boolean
  },

  start: number = 0
) => {
  console.log(format(new Date(), 'HH:mm:ss'), config.market_hash_name, start)

  await sleep(25_000)

  try {
    const steam = await getMarketRender({ market_hash_name: config.market_hash_name, start, count: 100 })

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      if (CASHED_LISTINGS.has(listingId)) continue

      const currentListing = steam.listinginfo[listingId]
      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))

      const assetInfo = steam.assets[730][currentListing.asset.contextid][currentListing.asset.id]
      const template = assetInfo.descriptions.find((el) => el.value.includes('Charm Template'))?.value || ''

      const templateId = template ? Number(template.match(/\d+/g)) : null

      if (templateId && config.canSendToTelegram && config.isSweet(templateId)) {
        const min_paintseed = Math.floor(templateId / 1000) * 1000
        const max_paintseed = Math.floor(templateId / 1000) * 1000 + 1000

        const response = await getBuff163GoodsSellOrder({ goods_id: config.goods_id, min_paintseed, max_paintseed })

        const buffFirstPrice = Number(Number(response.data?.items?.[0]?.price || 0) * 0.138)

        await sendMessage(
          generateSteamMessage({
            price: price,
            buffFirstPrice,
            name: config.market_hash_name,
            position: start + index + 1,
            templateId,
          })
        )
      }

      CASHED_LISTINGS.add(listingId)
    }

    if (start + 100 < steam.total_count && start <= 600) {
      await findSteamItemInfo(config, start + 100)
    }
  } catch (error) {
    console.log(format(new Date(), 'HH:mm:ss'), 'STEAM_ERROR', error.message)
    await sleep(60_000 * 4)

    return
  }
}

;(async () => {
  do {
    for (const config of MARKET_HASH_NAMES) {
      await findSteamItemInfo(config)
    }

    MARKET_HASH_NAMES.forEach((_, index) => {
      MARKET_HASH_NAMES[index].canSendToTelegram = true
    })

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
