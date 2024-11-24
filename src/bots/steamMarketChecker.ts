import 'dotenv/config'

import { format } from 'date-fns'
import Bottleneck from 'bottleneck'
import { getMarketRender } from '../api/steam'
import { sendMessage } from '../api/telegram'
import { extractStickers, generateSteamMessage, sleep } from '../utils'
import { getBuff163MarketGoods } from '../api/buff163'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { Page } from 'puppeteer'
import { SteamInventoryHelperDetails } from '../types'

puppeteer.use(StealthPlugin())

const CASHED_LISTINGS = new Set<string>()
const STICKER_PRICES = new Map<string, number>()

const limiter = new Bottleneck({ maxConcurrent: 1 })

const MARKET_HASH_NAMES = ['AK-47 | Redline (Field-Tested)']

const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}

const findSteamItemInfo = async (page: Page, market_hash_name: string) => {
  try {
    const steam = await getMarketRender({ market_hash_name, start: 0, count: 10 })

    for (const [index, listingId] of Object.keys(steam.listinginfo).entries()) {
      if (CASHED_LISTINGS.has(listingId)) continue

      const currentListing = steam.listinginfo[listingId]
      const link = currentListing.asset.market_actions[0].link

      const price = Number(((currentListing.converted_price + currentListing.converted_fee) / 100).toFixed(2))
      const inspectLink = getInspectLink(link, currentListing.asset.id, listingId)

      CASHED_LISTINGS.add(listingId)

      try {
        await sleep(2_000)
        await page.goto(`https://floats.steaminventoryhelper.com/?url=${inspectLink}`, {
          waitUntil: 'domcontentloaded',
        })

        const response: SteamInventoryHelperDetails = await page.evaluate(() => {
          return JSON.parse(document.body.innerText)
        })

        const stickerTotalPrice = (response.iteminfo?.stickers || []).reduce(
          (acc, { wear, name }) => (wear === 0 ? acc + (STICKER_PRICES.get(`Sticker | ${name}`) ?? 0) : acc),
          0
        )

        console.log(
          format(new Date(), 'HH:mm:ss'),
          `${market_hash_name} ${response.iteminfo.floatvalue.toFixed(10)} $${stickerTotalPrice.toFixed(2)}`
        )

        if ((price && stickerTotalPrice > price) || response.iteminfo.floatvalue < 0.2) {
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
      } catch (error) {
        const assetInfo = steam.assets[730][currentListing.asset.contextid][currentListing.asset.id]
        const htmlDescription = assetInfo.descriptions.find((el) => el.value.includes('sticker_info'))?.value || ''

        const stickers = extractStickers(htmlDescription)

        const stickerTotalPrice = stickers.reduce(
          (acc, name) => acc + (STICKER_PRICES.get(`Sticker | ${name}`) ?? 0),
          0
        )

        console.log(format(new Date(), 'HH:mm:ss'), `${market_hash_name} $${stickerTotalPrice.toFixed(2)}`)

        if (price && stickerTotalPrice > price) {
          await sendMessage(
            generateSteamMessage({
              price: price,
              name: market_hash_name,
              stickers: stickers,
              stickerTotal: stickerTotalPrice,
              position: index + 1,
            })
          )
        }
      }
    }
  } catch (error) {
    await sleep(60_000 * 5)
    console.log(format(new Date(), 'HH:mm:ss'), 'STEAM_ERROR', error.message)
  }
}

;(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  })
  const page = await browser.newPage()

  const pages = Array.from({ length: 115 }, (_, i) => i + 1)

  for (const page_num of pages) {
    const goods = await getBuff163MarketGoods({
      page_num,
      category_group: 'sticker',
      sort_by: 'price.desc',
    })
    for (const item of goods.data.items) {
      const market_hash_name = item.market_hash_name
      const price = Number((Number(item.sell_min_price) * 0.1375).toFixed(2))
      console.log(page_num, market_hash_name, price, item.sell_num)
      STICKER_PRICES.set(market_hash_name, price)
    }
    if (goods.data.items.length !== 50) break
    await sleep(4_000)
  }

  do {
    await Promise.allSettled(MARKET_HASH_NAMES.map((name) => limiter.schedule(() => findSteamItemInfo(page, name))))

    await sleep(12_000) // Sleep 12s between requests

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
