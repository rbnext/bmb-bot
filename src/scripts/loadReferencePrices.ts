import 'dotenv/config'

import { readFileSync, writeFileSync } from 'fs'
import { getGoodsInfo, getMarketGoods } from '../api/buff'
import path from 'path'
import { sleep } from '../utils'
import { SteamDBItem } from '../types'
;(async () => {
  // const pathname = path.join(__dirname, '../../buff.json')
  const pathname = path.join(__dirname, '../steam/goods.json')
  const data: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))

  for (const market_hash_name of Object.keys(data)) {
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

    await sleep(3_000)
  }
})()

// ;(async () => {
//   const pages = Array.from({ length: 100 }, (_, i) => i + 1)
//   // const pathname = path.join(__dirname, '../../buff.json')
//   const pathname = path.join(__dirname, '../goods.json')

//   for (const page_num of pages) {
//     console.log([page_num])

//     const goods = await getMarketGoods({
//       page_num,
//       // category_group: 'sticker',
//       category_group: 'rifle',
//       sort_by: 'sell_null.desc',
//       min_price: 3,
//       max_price: 40,
//     })

//     for (const item of goods.data.items) {
//       const data: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))

//       if (!data[item.market_hash_name] && item.id) {
//         const goodsInfo = await getGoodsInfo({ goods_id: item.id })
//         const reference_price = Number(goodsInfo.data.goods_info.goods_ref_price)

//         console.log(item.market_hash_name, reference_price)

//         writeFileSync(
//           pathname,
//           JSON.stringify(
//             {
//               ...data,
//               [item.market_hash_name]: { goods_id: item.id, reference_price },
//             },
//             null,
//             4
//           )
//         )

//         await sleep(3_000)
//       }
//     }

//     await sleep(3_000)
//   }
// })()
