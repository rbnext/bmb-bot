// import 'dotenv/config'

// import UserAgent from 'user-agents'
// import { SteamMarketConfig } from '../types'
// import { getGoodsInfo, getMarketGoods } from '../api/buff'
// import { sleep } from '../utils'
// import { findSteamItemInfo } from './utils'

// const PROXY = process.env.STEAM_PROXY?.trim() as string
// const MARKET_HASH_NAMES = process.env.STEAM_MARKET_HASH_NAMES?.split(';').map((name) => name.trim()) as string[]

// if (!PROXY || !Array.isArray(MARKET_HASH_NAMES)) {
//   throw new Error(`PROXY and MARKET_HASH_NAMES env's are required.`)
// }

// ;(async () => {
//   const configList: SteamMarketConfig[] = []

//   console.log('PROXY:', PROXY, '\n')

//   for (const market_hash_name of MARKET_HASH_NAMES) {
//     const canSendToTelegram = false
//     const userAgent = new UserAgent().toString()

//     const goods = await getMarketGoods({ search: market_hash_name })
//     const goods_id = goods.data.items.find((el) => el.market_hash_name === market_hash_name)?.id

//     if (goods_id) {
//       const goodsInfo = await getGoodsInfo({ goods_id })
//       const referencePrice = Number(goodsInfo.data.goods_info.goods_ref_price)
//       configList.push({ proxy: PROXY, market_hash_name, canSendToTelegram, userAgent, referencePrice })
//     }

//     await sleep(5_000)
//   }

//   console.log(configList.map((config) => `${config.market_hash_name}: $${config.referencePrice}`).join('\n'))

//   do {
//     for (const config of configList) {
//       await findSteamItemInfo(config).then(() => sleep(15_000))
//     }

//     configList.forEach((_, index) => {
//       configList[index].canSendToTelegram = true
//     })

//     // eslint-disable-next-line no-constant-condition
//   } while (true)
// })()
