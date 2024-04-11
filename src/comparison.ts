import schedule from 'node-schedule'
import { format } from 'date-fns/format'
import { getGoodsSellOrder, getMarketGoods } from './api'
import { getComparisonItems } from './api/pricempire'

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const SKIP_LIST: string[] = []

const initPriceComparison = async () => {
  schedule.scheduleJob('*/10 * * * * *', async () => {
    const now = format(new Date(), 'dd MMM yyyy, HH:mm')

    try {
      const comparison = await getComparisonItems()

      for (const item of comparison.items) {
        const hashName = item.hashName
        const roi = +Number(item.roi).toFixed(2)
        const fromPrice = item.fromPrice / 100

        if (SKIP_LIST.includes(hashName)) {
          continue
        }

        const response = await getMarketGoods({ search: hashName })

        const data = response.data.items.find(
          (item) => hashName === item.market_hash_name && fromPrice === Number(item.sell_min_price)
        )

        if (data?.market_hash_name && data?.sell_min_price) {
          const goods = await getGoodsSellOrder({ goods_id: data.id })

          const filteredGoods = goods.data.items.filter((item) => fromPrice >= Number(item.price))

          for (const { user_id, price } of filteredGoods) {
            const nickname = goods?.data?.user_infos[user_id]?.nickname ?? user_id
            const message = `[Bot] Purchased "${hashName}" item from ${nickname} for ${price}$, ROI: ${roi}%`

            console.log(message)
          }
        } else {
          console.log(`[Bot] Item "${hashName}" has been sold out`)
        }

        SKIP_LIST.push(hashName)
      }
    } catch (error) {
      console.log('Something went wrong')
    }
  })
}

process.once('SIGINT', () => {
  schedule.gracefulShutdown().then(() => process.exit(0))
})

process.once('SIGTERM', () => {
  schedule.gracefulShutdown().then(() => process.exit(0))
})

initPriceComparison()

// try {
//   const goods = await Promise.all(goodsConfig.map(({ goods_id }) => getGoodsInfo({ goods_id })))

//   for (const good of goods) {
//     const referenceId = good.data.id
//     const name = good.data.super_short_name
//     const currentPrice = +good.data.sell_min_price

//     const limitOrder = goodsConfig.find(({ goods_id }) => goods_id === referenceId)?.limitOrder

//     if (!limitOrder) {
//       throw new Error('Limit order is not found')
//     }

//     if (currentPrice <= limitOrder) {
//       const data = await getGoodsSellOrder({ goods_id: referenceId })

//       const goodsToBuy = data.data.items.filter((item) => Number(item.price) <= limitOrder)

//       if (goodsToBuy.length === 0) {
//         await ctx.telegram.sendMessage(chatReferenceId, `Attempting to purchase an item failed`)

//         continue
//       }

//       for (const { user_id, price, id: sell_order_id } of goodsToBuy) {
//         const nickname = data?.data?.user_infos[user_id]?.nickname ?? user_id
//         const message = `[Bot] purchased "${name}" item from ${nickname} for ${price}$`

//         const response = await postGoodsBuy({ sell_order_id, price: Number(price) })

//         if (response.code === 'OK') {
//           await ctx.telegram.sendMessage(chatReferenceId, message)

//           continue
//         }

//         const errorMessage = `[Bot] Purchase attempt has been failed: ${JSON.stringify(response)}`

//         await ctx.telegram.sendMessage(chatReferenceId, errorMessage)

//         throw new Error(errorMessage)
//       }

//       const briefAsset = await getBriefAsset()
//       const balanceMessage = `[Bot] Balance after transaction(s): ${briefAsset?.data?.total_amount}$`

//       await ctx.telegram.sendMessage(chatReferenceId, balanceMessage)
//     }

//     console.log(`${now}: ${name} ${currentPrice}$/${limitOrder}$`)
//   }
// } catch (error) {
//   await ctx.telegram.sendMessage(chatReferenceId, error?.message ?? '[Bot] Something went wrong')

//   return
// }
