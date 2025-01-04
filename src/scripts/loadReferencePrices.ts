import 'dotenv/config'

import { readFileSync, writeFileSync } from 'fs'
import { getGoodsInfo, getMarketGoods } from '../api/buff'
import { getBuyOrders, getCSFloatListings } from '../api/csfloat'

import path from 'path'
import { getItemExterior, sleep } from '../utils'
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
// ;(async () => {
//   const pages = Array.from({ length: 100 }, (_, i) => i + 1)
//   const pathname = path.join(__dirname, '../../goods_id_v2.json')

//   for (const page_num of pages) {
//     console.log([page_num])

//     const goods = await getMarketGoods({
//       page_num,
//       min_price: 5,
//       max_price: 20,
//       quality: 'strange',
//       category_group: 'rifle,pistol,smg,shotgun,machinegun',
//     })
//     if (goods.data.items.length !== 50) {
//       return
//     }

//     const items: Record<string, { goods_id: number }> = goods.data.items.reduce(
//       (acc, cur) => ({
//         ...acc,
//         [cur.market_hash_name]: {
//           goods_id: cur.id,
//         },
//       }),
//       {}
//     )

//     const data: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))
//     writeFileSync(pathname, JSON.stringify({ ...data, ...items }, null, 4))

//     await sleep(3_000)
//   }
// })()
// ;(async () => {
//   const pathname = path.join(__dirname, '../../goods_id_v2.json')
//   const goods_id: Record<string, { goods_id: number; price: number }> = JSON.parse(readFileSync(pathname, 'utf8'))

//   for (const [market_hash_name, goods_info] of Object.entries(goods_id)) {
//     const { isFactoryNew, isMinimalWear, isFieldTested, isWellWorn, isBattleScarred, isStatTrak } =
//       getItemExterior(market_hash_name)

//     if (goods_info.price) continue

//     if (isFactoryNew || isMinimalWear) {
//       const items = await getCSFloatListings({
//         market_hash_name,
//         category: isStatTrak ? 2 : 1,
//         ...(isFactoryNew && { max_float: 0.07 }),
//         ...(isMinimalWear && { min_float: 0.07, max_float: 0.15 }),
//         ...(isFieldTested && { min_float: 0.15, max_float: 0.38 }),
//         ...(isWellWorn && { min_float: 0.38, max_float: 0.45 }),
//         ...(isBattleScarred && { min_float: 0.45 }),
//       })

//       if (!items.data[0]) continue

//       const orders = await getBuyOrders({ id: items.data[0].id })
//       if (!orders[0]?.price) continue

//       const data = JSON.parse(readFileSync(pathname, 'utf8'))
//       writeFileSync(
//         pathname,
//         JSON.stringify(
//           {
//             ...data,
//             [market_hash_name]: {
//               ...goods_info,
//               price: Number((Math.min(items.data[0].price, items.data[0].reference.predicted_price) / 100).toFixed(2)),
//               buy_price: Number((orders[0].price / 100).toFixed(2)),
//             },
//           },
//           null,
//           4
//         )
//       )

//       await sleep(5_000)
//     }
//   }
// })()
;(async () => {
  const pathname = path.join(__dirname, '../../goods_id_v2.json')
  const goods_id: Record<string, { goods_id: number; price: number; buy_price: number }> = JSON.parse(
    readFileSync(pathname, 'utf8')
  )

  console.log('market_hash_name;price;buy_price;cs_link;steam_link')
  for (const [market_hash_name, goods_info] of Object.entries(goods_id)) {
    const { isFactoryNew, isMinimalWear, isFieldTested, isWellWorn, isBattleScarred, isStatTrak } =
      getItemExterior(market_hash_name)

    if (goods_info.price) {
      const float_data = {
        ...(isFactoryNew && { max_float: 0.07 }),
        ...(isMinimalWear && { min_float: 0.07, max_float: 0.15 }),
        ...(isFieldTested && { min_float: 0.15, max_float: 0.38 }),
        ...(isWellWorn && { min_float: 0.38, max_float: 0.45 }),
        ...(isBattleScarred && { min_float: 0.45 }),
      }

      const cs_link = `https://csfloat.com/search?category=${isStatTrak ? 2 : 1}&market_hash_name=${encodeURIComponent(market_hash_name)}&type=buy_now&${Object.entries(
        float_data
      )
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')}`

      const steam_link = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(market_hash_name)}`

      console.log(
        `${market_hash_name};${goods_info.price.toFixed(2).replace('.', ',')};${goods_info.buy_price.toFixed(2).replace('.', ',')};${cs_link};${steam_link}`
      )
    }
  }
})()
