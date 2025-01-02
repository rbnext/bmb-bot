import 'dotenv/config'

import { readFileSync, writeFileSync } from 'fs'
import { getGoodsInfo, getMarketGoods } from '../api/buff'
import path from 'path'
import { sleep } from '../utils'
import { SteamDBItem } from '../types'
// ;(async () => {
//   const pathname = path.join(__dirname, '../../buff.json')
//   const data: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))

//   for (const market_hash_name of Object.keys(data)) {
//     if (data[market_hash_name].reference_price < 0.99) {
//       continue
//     }

//     const goods_id = data[market_hash_name].goods_id

//     const goodsInfo = await getGoodsInfo({ goods_id })
//     const reference_price = Number(goodsInfo.data.goods_info.goods_ref_price)

//     if (goodsInfo.data.market_hash_name === market_hash_name) {
//       const data: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))

//       console.log(data[market_hash_name].reference_price, '->', reference_price)

//       delete data[market_hash_name]

//       writeFileSync(
//         pathname,
//         JSON.stringify(
//           {
//             ...data,
//             [market_hash_name]: {
//               goods_id,
//               reference_price,
//             },
//           },
//           null,
//           4
//         )
//       )
//     } else {
//       console.log('error')
//     }

//     await sleep(2_500)
//   }
// })()
// ;(async () => {
//   const pages = Array.from({ length: 100 }, (_, i) => i + 1)
//   const pathname = path.join(__dirname, '../../buff.json')

//   for (const page_num of pages) {
//     console.log([page_num])

//     const goods = await getMarketGoods({
//       page_num,
//       category_group: 'sticker',
//       // min_price: 3,
//       // max_price: 40,
//       search: '2024',
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
;(async () => {
  const pages = Array.from({ length: 100 }, (_, i) => i + 1)
  const pathname = path.join(__dirname, '../../goods_id.json')

  for (const page_num of pages) {
    console.log([page_num])

    const goods = await getMarketGoods({
      page_num,
      min_price: 5,
      max_price: 25,
      quality: 'normal',
      category_group: 'rifle,pistol,smg,shotgun,machinegun',
    })
    if (goods.data.items.length !== 50) {
      return
    }

    const items = goods.data.items.reduce((acc, cur) => ({ ...acc, [cur.market_hash_name]: cur.id }), {})

    const data: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))
    writeFileSync(pathname, JSON.stringify({ ...data, ...items }, null, 4))

    await sleep(3_000)
  }
})()
