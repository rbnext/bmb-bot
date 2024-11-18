import 'dotenv/config'

import { format } from 'date-fns'
import Bottleneck from 'bottleneck'
import { getMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { generateSteamMessage, sleep } from '../utils'
import { getIPInspectItemInfo } from '../api/pricempire'
import { getBuff163MarketGoods } from '../api/buff163'

const LOADED_ITEMS: string[] = []
const CASHED_LISTINGS = new Set<string>()
const STICKER_PRICES = new Map<string, number>()
const MIN_TREADS: number = 1

const limiter = new Bottleneck({ maxConcurrent: MIN_TREADS })

const MARKET_HASH_NAMES = ['Charm | Die-cast AK', 'Charm | Titeenium AWP', 'Charm | Semi-Precious']

const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}

const findSteamItemInfo = async (market_hash_name: string) => {
  const now = format(new Date(), 'HH:mm:ss')

  try {
    const isCharm = market_hash_name.includes('Charm')
    const steam = await getMarketRender({ market_hash_name, count: isCharm ? 100 : 20 })

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      if (CASHED_LISTINGS.has(listingId)) continue

      const currentListing = steam.listinginfo[listingId]
      const link = currentListing.asset.market_actions[0].link

      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))
      const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)

      if (isCharm) {
        const descriptions = steam.assets[730][currentListing.asset.contextid][currentListing.asset.id].descriptions
        const template = descriptions.find((el) => el.value.includes('Charm Template'))
        const templateId = template ? Number(template.value.match(/\d+/)?.[0]) : null

        const isSweetTemplate = (() => {
          if (templateId && market_hash_name.includes('Charm | Die-cast AK')) {
            return templateId < 27000 || templateId > 90000
          }

          if (templateId && market_hash_name.includes('Charm | Titeenium AWP')) {
            return templateId > 93000
          }

          if (templateId && market_hash_name.includes('Charm | Semi-Precious')) {
            return templateId < 10000 || templateId > 90000
          }

          return false
        })()

        console.log(now, market_hash_name, templateId)

        if (templateId && isSweetTemplate) {
          await sendMessage(
            generateSteamMessage({
              price: price,
              name: market_hash_name,
              position: index + 1,
              templateId,
            })
          )

          await sleep(1_000)
        } else if (templateId === null && MARKET_HASH_NAMES.length === LOADED_ITEMS.length) {
          await sendMessage(
            generateSteamMessage({
              price: price,
              name: market_hash_name,
              position: index + 1,
              templateId: 0,
            })
          )

          await sleep(1_000)
        }
      } else {
        try {
          const response = await getIPInspectItemInfo({ url: inspectLink })

          const floatValue = response.iteminfo.floatvalue
          const stickerTotalPrice = (response.iteminfo?.stickers || []).reduce(
            (acc, { wear, name }) => (wear === null ? acc + (STICKER_PRICES.get(`Sticker | ${name}`) ?? 0) : acc),
            0
          )

          const isSweetFloat = (() => {
            if (market_hash_name.includes('Factory New')) {
              return floatValue < 0.01
            }

            if (market_hash_name.includes('Minimal Wear')) {
              return floatValue < 0.08
            }

            if (market_hash_name.includes('Field-Tested')) {
              return floatValue < 0.16
            }

            if (market_hash_name.includes('Battle-Scarred')) {
              return floatValue >= 0.95
            }

            return false
          })()

          if (stickerTotalPrice >= price) {
            await sendMessage(
              generateSteamMessage({
                price: price,
                name: market_hash_name,
                float: response.iteminfo.floatvalue,
                stickers: response.iteminfo?.stickers || [],
                stickerTotal: stickerTotalPrice,
                position: index + 1,
              })
            )
          }

          console.log(
            now,
            market_hash_name,
            '$' + price,
            response.iteminfo.floatvalue,
            '$' + stickerTotalPrice.toFixed(2)
          )
        } catch (error) {
          console.log(now, `ERROR: Failed to inspect item from pricempire.com`)
        }
      }

      CASHED_LISTINGS.add(listingId)

      await sleep(1_000)
    }

    LOADED_ITEMS.push(market_hash_name)
  } catch (error) {
    console.log(now, `ERROR: Failed to inspect ${market_hash_name} from steamcommunity.com`)
  }
}

;(async () => {
  const pages = Array.from({ length: 100 }, (_, i) => i + 1)

  // for (const page_num of pages) {
  //   const goods = await getBuff163MarketGoods({
  //     page_num,
  //     category_group: 'sticker',
  //     sort_by: 'sell_num.desc',
  //     min_price: 1,
  //   })
  //   for (const item of goods.data.items) {
  //     const market_hash_name = item.market_hash_name
  //     const price = Number((Number(item.sell_min_price) * 0.1375).toFixed(2))
  //     console.log(page_num, market_hash_name, price, item.sell_num)
  //     STICKER_PRICES.set(market_hash_name, price)
  //   }
  //   if (goods.data.items.length !== 50) break
  //   await sleep(5_000)
  // }

  do {
    const results = await Promise.allSettled(
      MARKET_HASH_NAMES.map((name) => {
        return limiter.schedule(() => findSteamItemInfo(name))
      })
    )

    if (results.every((result) => result.status === 'rejected')) {
      break // Exit the loop if all responses are errors
    }

    await sleep(50_000) // Sleep 50s between requests

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
