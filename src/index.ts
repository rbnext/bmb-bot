import { Telegraf } from 'telegraf'
import schedule from 'node-schedule'
import { format } from 'date-fns/format'

import { getGoodsSellOrder, getMarketGoods } from './api'
import { getComparisonItems } from './api/pricempire'

const SKIP_LIST: string[] = []
const JOBS: Record<string, schedule.Job> = {}

const bot = new Telegraf(process.env.BOT_TOKEN as string)

bot.command('start', async (ctx) => {
  const chatReferenceId = ctx.message.chat.id

  JOBS[chatReferenceId]?.cancel()

  JOBS[chatReferenceId] = schedule.scheduleJob('*/10 * * * * *', async () => {
    const now = format(new Date(), 'dd MMM yyyy, HH:mm')

    try {
      const comparison = await getComparisonItems()

      for (const item of comparison.items) {
        const hashName = item.hashName
        const roi = +Number(item.roi).toFixed(2)
        const fromPrice = item.fromPrice / 100

        if (SKIP_LIST.includes(hashName)) {
          console.log(`${now}: ${hashName} item has been skipped`)

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

            await ctx.telegram.sendMessage(chatReferenceId, message)
          }
        } else {
          await ctx.telegram.sendMessage(chatReferenceId, `[Bot] Item "${hashName}" has been sold out`)
        }

        SKIP_LIST.push(hashName)
      }
    } catch (error) {
      await ctx.telegram.sendMessage(chatReferenceId, `[Bot] Something went wrong`)

      console.log(`Something went wrong: `, error)
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
