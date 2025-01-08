import 'dotenv/config'

import { format } from 'date-fns'
import { getMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { extractStickers, getCSFloatItemPrice, getSteamUrl, sleep } from '../utils'
import { getInspectLink, isStickerCombo } from './utils'

import { getCSFloatItemInfo, getCSFloatListings } from '../api/csfloat'
import UserAgent from 'user-agents'

const CASHED_LISTINGS = new Set<string>()

const MARKET_HASH_NAMES = [
  {
    market_hash_name: 'StatTrak™ AK-47 | Slate (Field-Tested)',
    userAgent: new UserAgent().toString(),
    canSendToTelegram: false,
    referencePrice: 10.9,
  },
]

const findSteamItemInfo = async (config: {
  market_hash_name: string
  canSendToTelegram: boolean
  referencePrice: number
  userAgent: string
}) => {
  try {
    const steam = await getMarketRender({
      userAgent: config.userAgent,
      market_hash_name: config.market_hash_name,
      count: 20,
    })

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      if (CASHED_LISTINGS.has(listingId)) continue

      const currentListing = steam.listinginfo[listingId]
      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))

      const assetInfo = steam.assets[730][currentListing.asset.contextid][currentListing.asset.id]
      const htmlDescription = assetInfo.descriptions.find((el) => el.value.includes('sticker_info'))?.value || ''

      const link = currentListing.asset.market_actions[0].link
      const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)

      const stickers = extractStickers(htmlDescription)

      if (isStickerCombo(stickers) && config.canSendToTelegram) {
        const response = await getCSFloatListings({
          market_hash_name: `Sticker | ${stickers[0]}`,
        })
        const stickerPrice = getCSFloatItemPrice(response)

        console.log(format(new Date(), 'HH:mm:ss'), config.market_hash_name, stickerPrice.toFixed(2))

        if (stickerPrice >= 2.5) {
          const itemInfoResponse = await getCSFloatItemInfo({ url: inspectLink })

          const message: string[] = []

          message.push(
            `<a href="${getSteamUrl(config.market_hash_name)}">${config.market_hash_name}</a> | #${index + 1}\n\n`
          )

          for (const sticker of itemInfoResponse.iteminfo?.stickers ?? []) {
            message.push(
              `<b>${sticker.name}</b>: ${sticker.wear === 0 ? '100%' : `${(sticker.wear * 100).toFixed(2)}%`}\n`
            )
          }
          message.push(`\n`)
          message.push(`<b>Steam price</b>: $${price}\n`)
          message.push(`<b>Reference price</b>: $${config.referencePrice}\n`)
          message.push(`<b>Stickers total</b>: $${(stickerPrice * stickers.length).toFixed(2)}\n\n`)
          message.push(`<b>Float</b>: ${itemInfoResponse.iteminfo.floatvalue}}\n\n`)

          await sendMessage(message.join(''))

          await sleep(3_000)
        }
      }

      CASHED_LISTINGS.add(listingId)
    }

    config.canSendToTelegram = true
  } catch (error) {
    if (error.message !== 'canceled') await sleep(60_000 * 4)

    console.log(format(new Date(), 'HH:mm:ss'), 'STEAM_ERROR', error.message)

    return
  }
}

;(async () => {
  do {
    for (const config of MARKET_HASH_NAMES) {
      await findSteamItemInfo(config).then(() => sleep(20_000))
    }

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
