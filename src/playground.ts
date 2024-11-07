import 'dotenv/config'
import { getCreatePreviewBargain, getSentBargain, postCancelBargain, postCreateBargain } from './api/buff'
import { getDifferenceInMinutes, sleep } from './utils'

const ACTIVE_BARGAINS = new Set<string>()

const init = async () => {
  const bargains = await getSentBargain({})

  for (const bargain of bargains.data.items) {
    const diffCreateCancelInMinutes = getDifferenceInMinutes(bargain.can_cancel_time, bargain.created_at)

    if (
      diffCreateCancelInMinutes < 5 &&
      bargain.can_cancel_timeout < -1 &&
      !ACTIVE_BARGAINS.has(bargain.sell_order_id)
    ) {
      ACTIVE_BARGAINS.add(bargain.sell_order_id)

      console.log('bargain.created_at', bargain.created_at)
      console.log('bargain.can_cancel_time', bargain.can_cancel_time)

      await postCancelBargain({ bargain_id: bargain.id })
      await sleep(3_000)

      for (const fee of [0.3, 0.55, 1.1, 1.55]) {
        const price = Number((Number(bargain.price) + fee).toFixed(2))
        const preview = await getCreatePreviewBargain({ sell_order_id: bargain.sell_order_id, price })
        const isFailed = preview.data?.pay_confirm?.id === 'bargain_higher_price'

        console.log(bargain.goods_id, fee, isFailed ? 'failed' : 'success')

        if (!isFailed) {
          await postCreateBargain({ sell_order_id: bargain.sell_order_id, price })
          break
        }

        await sleep(3_000)
      }
    }
  }

  await sleep(30_000)

  init()
}

// const init = async () => {
//   const pages = Array.from({ length: 2 }, (_, i) => i + 2)
//   for (const page_num of pages) {
//     const bargains = await getSentBargain({ page_num })

//     for (const bargain of bargains.data.items) {
//       const response = await getShopBillOrder({ user_id: bargain.seller_id })

//       if (bargain.asset_info.paintwear) {
//         const market_hash_name = bargains.data.goods_infos[bargain.goods_id].market_hash_name
//         const item = response.data.items.find((el) => el.asset_info.paintwear === bargain.asset_info.paintwear)

//         if (item) {
//           console.log(market_hash_name, `${bargain.price}/${item.original_price} ->`, item.price)
//         }
//       }

//       await sleep(5_000)
//     }
//     await sleep(5_000)
//   }
// }

init()
