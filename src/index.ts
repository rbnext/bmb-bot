import { Telegraf } from 'telegraf'
import schedule from 'node-schedule'

import { getBriefAsset, getGoodsInfo, getGoodsSellOrder, postGoodsBuy } from './api'
import { goodsConfig } from './config'

export const JOBS: Record<string, schedule.Job> = {}

const bot = new Telegraf(process.env.BOT_TOKEN as string)

bot.command('start', async (ctx) => {
  const chatReferenceId = ctx.message.chat.id

  JOBS[chatReferenceId]?.cancel()

  JOBS[chatReferenceId] = schedule.scheduleJob('*/5 * * * *', async () => {
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
            try {
              const nickname = data?.data?.user_infos[user_id]?.nickname ?? user_id
              const message = `Bot purchased "${name}" item from ${nickname} for ${price}$`

              const response = await postGoodsBuy({ sell_order_id, price: Number(price) })

              if (response.code === 'OK') {
                await ctx.telegram.sendMessage(chatReferenceId, message)
              } else {
                await ctx.telegram.sendMessage(chatReferenceId, response.error)
              }
            } catch (error) {
              throw new Error(error.message ?? 'Purchase attempt has been failed')
            }
          }
        }

        console.log(`${name}: ${currentPrice}$`)
      }
    } catch (error) {
      JOBS[chatReferenceId]?.cancel()

      await ctx.telegram.sendMessage(chatReferenceId, error.message ?? 'Something went wrong')

      return
    }
  })

  await ctx.telegram.sendMessage(chatReferenceId, `Bot started working..`)
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
