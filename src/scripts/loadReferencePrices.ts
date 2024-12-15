import 'dotenv/config'

import { readFileSync, writeFileSync } from 'fs'
import { getGoodsInfo } from '../api/buff'
import path from 'path'
import { sleep } from '../utils'
import { SteamDBItem } from '../types'
;(async () => {
  const pathname = path.join(__dirname, '../../buff.json')
  const data: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))

  for (const market_hash_name of Object.keys(data)) {
    if (data[market_hash_name].reference_price < 0.99) {
      continue
    }

    const goodsInfo = await getGoodsInfo({ goods_id: data[market_hash_name].goods_id })
    const reference_price = Number(goodsInfo.data.goods_info.goods_ref_price)

    if (goodsInfo.data.market_hash_name === market_hash_name) {
      const data: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))

      console.log(data[market_hash_name].reference_price, '->', reference_price)

      writeFileSync(
        pathname,
        JSON.stringify(
          {
            ...data,
            [market_hash_name]: { ...data[market_hash_name], reference_price },
          },
          null,
          4
        )
      )
    } else {
      console.log('error')
    }

    await sleep(2_500)
  }
})()
