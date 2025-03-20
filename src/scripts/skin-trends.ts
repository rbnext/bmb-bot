import puppeteer from 'puppeteer-extra'
import { PriceEmpireTrendItem, PriceEmpireTrendResponse } from '../types'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { sleep } from '../utils'

const pathname = path.join(__dirname, '../../cs2-trends.json')

;(async () => {
  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()

  const cookies = []

  await page.setCookie(...cookies)

  const pages = Array.from({ length: 10 }, (_, i) => 2 + i)
  const trendingItems: PriceEmpireTrendItem[] = []

  for (const page_num of pages) {
    await page.goto(
      `https://api.pricempire.com/v3/trending/items?from=${10}&to=${100}&sort=trades_30d:DESC&page=${page_num}&owned=false`
    )

    const response: PriceEmpireTrendResponse = await page.evaluate(() => {
      return JSON.parse(document.querySelector('pre')?.textContent || 'null')
    })

    trendingItems.push(...response.items)

    await sleep(2_000)
  }

  for (const item of trendingItems) {
    if (
      item.buff_percent_d1 >= -3.5 &&
      item.buff_percent_d1 <= 5 &&
      item.buff_percent_d7 >= -3.5 &&
      item.buff_percent_d7 <= 10 &&
      item.buff_percent_d30 > 0 &&
      Number(item.liquidity) > 95
    ) {
      console.log(
        item.marketHashName,
        item.buff_percent_d1,
        item.buff_percent_d7,
        item.buff_percent_d30,
        Number(item.liquidity)
      )

      const trendItems: Record<string, string> = JSON.parse(readFileSync(pathname, 'utf8'))
      writeFileSync(pathname, JSON.stringify({ ...trendItems, [item.marketHashName]: item.trades_30d }, null, 4))
    } else {
      console.log('-', item.marketHashName, item.buff_percent_d1, item.buff_percent_d7, item.buff_percent_d30)
    }
  }

  await browser.close()
})()
