import path from 'path'
import { readFileSync } from 'fs'
import { SteamDBItem, SteamMarketConfig } from '../types'
import { getGoodsInfo, getMarketGoods } from '../api/buff'
import { extractStickers, generateSteamMessage, sleep } from '../utils'
import { getMarketRender } from '../api/steam'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { PROXY_BAN_TIME, marketHashNameState, proxyState } from './steam-gold'

const CASHED_LISTINGS = new Set<string>()

export const getStickerDetails = async (stickers: string[]) => {
  const details: Record<string, number> = {}

  const pathname = path.join(__dirname, '../../buff.json')
  const steam_db: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))

  try {
    for (const sticker of [...new Set(stickers)]) {
      const market_hash_name = `Sticker | ${sticker}`

      if (steam_db[market_hash_name]) {
        details[sticker] = Number(steam_db[market_hash_name].reference_price)
      } else {
        const goods = await getMarketGoods({ search: market_hash_name })
        const goods_id = goods.data.items.find((el) => el.market_hash_name === market_hash_name)?.id

        if (goods_id) {
          const goodsInfo = await getGoodsInfo({ goods_id })
          details[sticker] = Number(goodsInfo.data.goods_info.goods_ref_price)
        }

        console.log('-', market_hash_name)

        await sleep(1_000)
      }
    }

    return details
  } catch (error) {
    console.log('BUFF.MARKET', error.message)

    return {}
  }
}

export const findSteamItemInfo = async (config: SteamMarketConfig, start: number = 0) => {
  const proxyData = proxyState.find((item) => item.proxy === config.proxy)
  const marketHashNameData = marketHashNameState.find((item) => item.name === config.market_hash_name)

  if (proxyData) proxyData.lastUsed = Date.now()

  try {
    const steam = await getMarketRender({
      proxy: config.proxy,
      userAgent: marketHashNameData?.userAgent ?? '',
      market_hash_name: config.market_hash_name,
      start,
      count: 50,
    })

    if (!steam.success) {
      throw new Error('bad response')
    }

    if (marketHashNameData) marketHashNameData.lastRequested = Date.now()

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      const position = start + index + 1

      const currentListing = steam.listinginfo[listingId]
      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))

      const link = currentListing.asset.market_actions[0].link
      const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)

      const referenceId = listingId + currentListing.asset.id

      const assetInfo = steam.assets[730][currentListing.asset.contextid][currentListing.asset.id]
      const htmlDescription = assetInfo.descriptions.find((el) => el.value.includes('sticker_info'))?.value || ''

      const stickers = extractStickers(htmlDescription)

      if (CASHED_LISTINGS.has(referenceId)) continue

      if (price && stickers.length !== 0 && marketHashNameData?.steamDataFetched) {
        const details = await getStickerDetails(stickers)
        const totalCost = calculateTotalCost(stickers, details)

        const estimatedProfit = ((marketHashNameData.referencePrice + totalCost - price) / price) * 100
        const stickerTotalPrice = stickers.reduce((acc, name) => acc + (details[name] ?? 0), 0)

        console.log(
          format(new Date(), 'HH:mm:ss'),
          config.market_hash_name,
          `${estimatedProfit.toFixed(2)}%`,
          `#${position}`
        )

        if (estimatedProfit >= 0) {
          await sendMessage(
            generateSteamMessage({
              price: price,
              name: config.market_hash_name,
              position,
              referencePrice: marketHashNameData.referencePrice,
              stickerTotal: stickerTotalPrice,
              estimatedProfit,
              inspectLink,
              stickers,
              details,
            })
          )
        }
      }

      CASHED_LISTINGS.add(referenceId)
    }

    if (marketHashNameData) marketHashNameData.steamDataFetched = true
  } catch (error) {
    console.log('STEAM_ERROR', config.proxy, error.message)

    if (proxyData && !['canceled', 'bad response', 'status code 502'].includes(error.message)) {
      proxyData.active = false
      proxyData.bannedUntil = Date.now() + PROXY_BAN_TIME
    } else {
      if (proxyData) proxyData.lastUsed = Date.now()
      if (marketHashNameData) marketHashNameData.lastRequested = Date.now()
    }
  }
}

export const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}

export const calculateTotalCost = (stickers: string[], details: Record<string, number>): number => {
  const groupByStickerName = stickers.reduce<Record<string, number>>((acc, name) => {
    return { ...acc, [name]: (acc[name] || 0) + 1 }
  }, {})

  const totalCost = Object.keys(groupByStickerName).reduce((acc, name) => {
    const price = details[name] || 0
    const stickerCount = groupByStickerName[name]
    const discountRate = stickerCount >= 4 ? 0.4 : 0.15

    return acc + price * discountRate * stickerCount
  }, 0)

  return totalCost
}
