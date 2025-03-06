import 'dotenv/config'

import { getGoodsInfo, getMarketGoods, getMarketGoodsBillOrder } from './api/buff'
import { getDifferenceInMinutes, median, sleep } from './utils'
import path from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { getMarketHashNameHistory } from './api/csfloat'
import { differenceInMinutes } from 'date-fns'

const init = async () => {
  const pages = Array.from({ length: 60 }, (_, i) => i + 1)
  const pathname = path.join(__dirname, '../top-float-items.json')

  for (const page_num of pages) {
    const goods = await getMarketGoods({
      page_num,
      min_price: 4,
      max_price: 50,
    })
    const mostPopularItems: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

    for (const item of goods.data.items) {
      if (item.market_hash_name in mostPopularItems) {
        mostPopularItems[item.market_hash_name] = item.id
      }
    }
    writeFileSync(pathname, JSON.stringify(mostPopularItems, null, 4))
    await sleep(5_000)
  }
}

init()
