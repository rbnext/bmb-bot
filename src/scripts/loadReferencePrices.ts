import 'dotenv/config'

import { readFileSync, writeFileSync } from 'fs'
import { getGoodsInfo, getMarketGoods } from '../api/buff'
import path from 'path'
import { sleep } from '../utils'
import { SteamDBItem } from '../types'
;(async () => {
  const pages = Array.from({ length: 100 }, (_, i) => i + 1)
  const pathname = path.join(__dirname, '../../buff.json')

  for (const page_num of pages) {
    console.log([page_num])

    const goods = await getMarketGoods({
      page_num,
      category_group: 'sticker',
      search: 'flex',
    })
    for (const item of goods.data.items) {
      const data: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))

      if (!data[item.market_hash_name] && item.id) {
        const goodsInfo = await getGoodsInfo({ goods_id: item.id })
        const reference_price = Number(goodsInfo.data.goods_info.goods_ref_price)

        console.log(item.market_hash_name, reference_price)

        writeFileSync(
          pathname,
          JSON.stringify(
            {
              ...data,
              [item.market_hash_name]: { goods_id: item.id, reference_price },
            },
            null,
            4
          )
        )

        await sleep(3_000)
      }
    }

    await sleep(3_000)
  }
})()
