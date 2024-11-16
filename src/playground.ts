import 'dotenv/config'

import { sleep } from './utils'

import { getBuff163MarketGoods } from './api/buff163'

const init = async () => {
  const pages = Array.from({ length: 100 }, (_, i) => i + 1)

  for (const page_num of pages) {
    const goods = await getBuff163MarketGoods({
      page_num,
      category_group: 'sticker',
      sort_by: 'sell_num.desc',
      min_price: 1,
    })
    for (const item of goods.data.items) {
      console.log(item.market_hash_name, Number((Number(item.sell_min_price) * 0.1375).toFixed(2)), item.sell_num)
    }
    if (goods.data.items.length !== 50) break
    await sleep(5_000)
  }
}

init()
