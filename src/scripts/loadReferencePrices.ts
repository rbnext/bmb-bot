// import 'dotenv/config'

// import { readFileSync, writeFileSync } from 'fs'
// import { getGoodsInfo, getMarketGoods } from '../api/buff'
// import path from 'path'
// import { sleep } from '../utils'
// import { SteamDBItem } from '../types'
// ;(async () => {
//   const pathname = path.join(__dirname, '../steam/goods.json')

//   const items: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))

//   const sortedEntries = Object.entries(items).sort(([, a], [, b]) => a.reference_price - b.reference_price)

//   const sortedItems = Object.fromEntries(sortedEntries)

//   writeFileSync(pathname, JSON.stringify(sortedItems, null, 4))

//   // for (const name of Object.keys(items)) {
//   //   const goods = await getMarketGoods({ search: name })
//   //   const goods_id = goods.data.items.find((el) => el.market_hash_name === name)?.id

//   //   if (goods_id) {
//   //     const goodsInfo = await getGoodsInfo({ goods_id })
//   //     const referencePrice = Number(goodsInfo.data.goods_info.goods_ref_price)

//   //     const data: SteamDBItem = JSON.parse(readFileSync(pathname, 'utf8'))

//   //     writeFileSync(
//   //       pathname,
//   //       JSON.stringify(
//   //         {
//   //           ...data,
//   //           [name]: { goods_id, reference_price: referencePrice },
//   //         },
//   //         null,
//   //         4
//   //       )
//   //     )
//   //   }

//   //   await sleep(5_000)
//   // }
// })()
