import 'dotenv/config'
import { getCreatePreviewBargain, getSentBargain, postCancelBargain, postCreateBargain } from './api/buff'
import { getDifferenceInMinutes, sleep } from './utils'
import { getCSFloatListings } from './api/csfloat'

const init = async (market_hash_name: string) => {
  const response = await getCSFloatListings({
    market_hash_name,
    min_float: 0.07,
    max_float: 0.15,
  })

  const item = response.data[0]

  if (item) {
    console.log(market_hash_name, Number(item.price / 100))
  }
}

init('AK-47 | Neon Revolution (Minimal Wear)')

// const ACTIVE_BARGAINS = new Set<string>()

// const generateFees = (diff: number, steps = 5): number[] => {
//   return Array.from({ length: steps }, (_, i) => parseFloat(((diff / steps) * (i + 1)).toFixed(2)))
// }

// const init = async () => {
//   const bargains = await getSentBargain({})

//   for (const bargain of bargains.data.items) {
//     const diffCreateCancelInMinutes = getDifferenceInMinutes(bargain.can_cancel_time, bargain.created_at)

//     if (
//       diffCreateCancelInMinutes < 5 &&
//       bargain.can_cancel_timeout < -1 &&
//       !ACTIVE_BARGAINS.has(bargain.sell_order_id)
//     ) {
//       ACTIVE_BARGAINS.add(bargain.sell_order_id)

//       console.log('bargain.created_at', bargain.created_at)
//       console.log('bargain.can_cancel_time', bargain.can_cancel_time)

//       await postCancelBargain({ bargain_id: bargain.id })
//       await sleep(3_000)

//       const original_price = Number(bargain.original_price)

//       const fees = generateFees((original_price - Number(bargain.price)) * original_price >= 50 ? 0.3 : 0.2)

//       console.log('Fees:', fees)

//       for (const fee of fees) {
//         const price = Number((Number(bargain.price) + fee).toFixed(2))
//         const preview = await getCreatePreviewBargain({ sell_order_id: bargain.sell_order_id, price })
//         const isFailed = preview.data?.pay_confirm?.id === 'bargain_higher_price'

//         console.log(bargain.goods_id, fee, isFailed ? 'failed' : 'success')

//         if (!isFailed) {
//           await postCreateBargain({ sell_order_id: bargain.sell_order_id, price })
//           break
//         }

//         await sleep(3_000)
//       }
//     }
//   }

//   await sleep(10_000)

//   init()
// }

// init()
