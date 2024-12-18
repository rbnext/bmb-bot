import 'dotenv/config'

import { getMarketPage, getSearchMarketRender } from '../api/steam'
import { CurrencyRates, Nullable, SteamMarketAssets, SteamMarketListingInfo } from '../types'
import { extractStickers, generateSteamMessage, sleep } from '../utils'
import { getLatestCurrencyRates } from '../api/currencyfreaks'
import { calculateTotalCost, getInspectLink, getItemReferencePrice, getStickerDetails } from './utils'
import { format } from 'date-fns'
import { CURRENCY_MAPPING, STICKER_TOTAL_THRESHOLD } from './config'
import { sendMessage } from '../api/telegram'

const CASHED_LISTINGS = new Set<string>()
const GOODS_CACHE: Record<string, { price: number }> = {}

let currencyRates: CurrencyRates['rates'] = {}

const assetsRegex = /var g_rgAssets = ({.*?});/
const listingInfoRegex = /var g_rgListingInfo = ({.*?});/

const fetchSteamMarketItem = async (config: { market_hash_name: string; proxy: string }) => {
  try {
    const html = await getMarketPage({
      proxy: config.proxy,
      market_hash_name: config.market_hash_name,
      filter: 'Sticker',
    })

    const match1 = html.match(assetsRegex)
    const assets: Nullable<SteamMarketAssets> = match1?.[1] ? JSON.parse(match1[1]) : null

    const match2 = html.match(listingInfoRegex)
    const listingInfo: Nullable<SteamMarketListingInfo> = match2?.[1] ? JSON.parse(match2[1]) : null

    if (!assets || !listingInfo) {
      throw new Error('LISTING_INFO_NOT_FOUND')
    }

    for (const [index, id] of Object.keys(listingInfo).entries()) {
      const currentListingInfo = listingInfo[id]
      const currentAsset = assets[730][2][currentListingInfo.asset.id]

      const assetId = currentListingInfo.asset.id
      const listingId = currentListingInfo.listingid

      const referenceId = listingId + assetId

      const currencyId = currentListingInfo.currencyid
      const currencyCode = CURRENCY_MAPPING[currencyId]

      const link = currentListingInfo.asset.market_actions[0].link
      const inspectLink = getInspectLink(link, assetId, listingId)

      if (!currencyCode) {
        throw new Error(`CURRENCY_CODE_NOT_FOUND: ${currencyId}`)
      }

      const price = Number(currentListingInfo.price + currentListingInfo.fee) / 100
      const convertedPrice = Number((price / Number(currencyRates[currencyCode])).toFixed(2))

      if (!CASHED_LISTINGS.has(referenceId)) CASHED_LISTINGS.add(referenceId)
      else continue

      const htmlDescription = currentAsset.descriptions.find((el) => el.value.includes('sticker_info'))?.value || ''

      const stickers = extractStickers(htmlDescription)

      if (convertedPrice && stickers.length !== 0 && index < 2) {
        const details = await getStickerDetails(stickers)
        const totalCost = calculateTotalCost(stickers, details)

        const stickerTotal = stickers.reduce((acc, name) => acc + (details[name] ?? 0), 0)

        console.log(format(new Date(), 'HH:mm:ss'), config.market_hash_name, `$${stickerTotal.toFixed(2)}`)

        if (stickerTotal < STICKER_TOTAL_THRESHOLD) {
          continue
        }

        const referencePrice = await getItemReferencePrice(config.market_hash_name)

        const estimatedProfit = ((referencePrice + totalCost - convertedPrice) / convertedPrice) * 100

        const payload = {
          price: convertedPrice,
          name: config.market_hash_name,
          referencePrice,
          estimatedProfit,
          position: index + 1,
          inspectLink,
          stickerTotal,
          stickers,
          details,
        }

        if (estimatedProfit >= -10) {
          await sendMessage(generateSteamMessage(payload))
        }
      }
    }
  } catch (error) {
    console.log(format(new Date(), 'HH:mm:ss'), error.message)
  }
}

async function init(): Promise<void> {
  let hasMarketUpdated: boolean = false

  const rates = await getLatestCurrencyRates()
  currencyRates = { ...rates.rates }

  const STEAM_PROXY = String(process.env.STEAM_PROXY).trim()
  const STEAM_SEARCH_START = Number(process.env.STEAM_SEARCH_START)

  console.log('STEAM_PROXY', STEAM_PROXY)
  console.log('STEAM_SEARCH_START', STEAM_SEARCH_START)

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const response = await getSearchMarketRender({
        query: 'Sticker',
        quality: ['tag_strange'],
        start: STEAM_SEARCH_START,
        proxy: STEAM_PROXY,
      })

      for (const item of response.results) {
        const market_hash_name = item.asset_description.market_hash_name

        if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].price !== item.sell_price) {
          hasMarketUpdated = true
        }

        if (market_hash_name in GOODS_CACHE && GOODS_CACHE[market_hash_name].price > item.sell_price) {
          fetchSteamMarketItem({ market_hash_name, proxy: STEAM_PROXY })
        }

        GOODS_CACHE[market_hash_name] = {
          price: item.sell_price,
        }
      }
    } catch (error) {
      console.log(error.message)
    } finally {
      await sleep(hasMarketUpdated ? 170_000 : 20_000)
      hasMarketUpdated = false
    }
  }
}

init()
