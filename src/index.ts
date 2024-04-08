import { Telegraf } from 'telegraf'
import schedule from 'node-schedule'
import { format } from 'date-fns/format'

import { getBriefAsset, getGoodsInfo, getGoodsSellOrder, postGoodsBuy } from './api'
import { goodsConfig } from './config'

export const JOBS: Record<string, schedule.Job> = {}

const bot = new Telegraf(process.env.BOT_TOKEN as string)

bot.command('start', async (ctx) => {
  const chatReferenceId = ctx.message.chat.id

  JOBS[chatReferenceId]?.cancel()

  JOBS[chatReferenceId] = schedule.scheduleJob('*/5 * * * *', async () => {
    const now = format(new Date(), 'dd MMM yyyy, HH:mm')

    try {
      const goods = await Promise.all(goodsConfig.map(({ goods_id }) => getGoodsInfo({ goods_id })))

      for (const good of goods) {
        const referenceId = good.data.id
        const name = good.data.super_short_name
        const currentPrice = +good.data.sell_min_price

        const limitOrder = goodsConfig.find(({ goods_id }) => goods_id === referenceId)?.limitOrder

        if (!limitOrder) {
          throw new Error('Limit order is not found')
        }

        if (currentPrice <= limitOrder) {
          const data = await getGoodsSellOrder({ goods_id: referenceId })

          const goodsToBuy = data.data.items.filter((item) => Number(item.price) <= limitOrder)

          if (goodsToBuy.length === 0) {
            await ctx.telegram.sendMessage(chatReferenceId, `Attempting to purchase an item failed`)

            continue
          }

          for (const { user_id, price, id: sell_order_id } of goodsToBuy) {
            const nickname = data?.data?.user_infos[user_id]?.nickname ?? user_id
            const message = `[Bot] purchased "${name}" item from ${nickname} for ${price}$`

            const response = await postGoodsBuy({ sell_order_id, price: Number(price) })

            if (response.code === 'OK') {
              await ctx.telegram.sendMessage(chatReferenceId, message)

              continue
            }

            const errorMessage = `[Bot] Purchase attempt has been failed: ${JSON.stringify(response)}`

            await ctx.telegram.sendMessage(chatReferenceId, errorMessage)

            throw new Error(errorMessage)
          }

          const briefAsset = await getBriefAsset()
          const balanceMessage = `[Bot] Balance after transaction(s): ${briefAsset?.data?.total_amount}$`

          await ctx.telegram.sendMessage(chatReferenceId, balanceMessage)
        }

        console.log(`${now}: ${name} ${currentPrice}$/${limitOrder}$`)
      }
    } catch (error) {
      JOBS[chatReferenceId]?.cancel()

      await ctx.telegram.sendMessage(chatReferenceId, error?.message ?? '[Bot] Something went wrong')

      return
    }
  })

  await ctx.telegram.sendMessage(chatReferenceId, `[Bot] Started working`)
})

bot.command('stop', async (ctx) => {
  JOBS[ctx.message.chat.id]?.cancel()
})

bot.command('quit', async (ctx) => {
  JOBS[ctx.message.chat.id]?.cancel()

  await ctx.telegram.leaveChat(ctx.message.chat.id)

  await ctx.leaveChat()
})

bot.launch()

process.once('SIGINT', () => {
  bot.stop('SIGINT')
  schedule.gracefulShutdown().then(() => process.exit(0))
})

process.once('SIGTERM', () => {
  bot.stop('SIGTERM')
  schedule.gracefulShutdown().then(() => process.exit(0))
})
