import 'dotenv/config'
// import { getCreatePreviewBargain, getSentBargain, postCancelBargain, postCreateBargain } from './api/buff'
// import { getDifferenceInMinutes, sleep } from './utils'
// import { getCSFloatListings } from './api/csfloat'
// import { getSkinPortListings } from './api/skinport'

import { io } from 'socket.io-client'
import socketParser from 'socket.io-msgpack-parser'
import { SkinPortListings, SkinPortListingsItem } from './types'

const init = async () => {
  const socket = io('https://skinport.com', {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    parser: socketParser,
  })

  socket.on('saleFeed', (data: { eventType: string; sales: SkinPortListingsItem[] }) => {
    if (data.eventType === 'listed') {
      for (const item of data.sales) {
        console.log(item.marketHashName, (item.salePrice / 100).toFixed(2))
      }
    }
  })

  socket.on('connect', async () => {
    console.debug('[BetterFloat] Successfully connected to Skinport websocket.')
    socket.emit('saleFeedJoin', { appid: 730, currency: 'USD', locale: 'en' })
  })

  // Socket should automatically reconnect, but if it doesn't, log the error.
  socket.on('disconnect', () => {
    console.warn('[BetterFloat] Disconnected from websocket.')
  })
}

init()

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
