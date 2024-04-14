import { Telegraf } from 'telegraf'
import schedule from 'node-schedule'
import { format } from 'date-fns/format'

import { getMarketGoods } from './api/buff'
import { getMarketPriceOverview } from './api/steam'
import { weaponCases } from './config'
import { sleep } from './utils'

const JOBS: Record<string, schedule.Job> = {}

const bot = new Telegraf(process.env.BOT_TOKEN as string)

bot.command('start', async (ctx) => {
  const chatReferenceId = ctx.message.chat.id

  JOBS[chatReferenceId]?.cancel()

  JOBS[chatReferenceId] = schedule.scheduleJob('*/20 * * * *', async () => {
    try {
      const response = await getMarketGoods({ category: 'csgo_type_weaponcase', itemset: weaponCases.join(',') })

      for (const { sell_min_price, market_hash_name } of response.data.items) {
        const now = format(new Date(), 'dd MMM yyyy, HH:mm')

        const { lowest_price } = await getMarketPriceOverview({ market_hash_name })

        if (!lowest_price) {
          console.log(`${now}: Warning. ${market_hash_name} lowest price has not been found`)

          continue
        }

        const buff = Number(sell_min_price)
        const steam = Number(lowest_price.slice(1))
        const roi = ((steam * 0.87) / buff - 1) * 100

        const message = `Item "${market_hash_name}". Buff: ${buff}$ | Steam: ${steam}$ | ROI: ${roi.toFixed(2)}%`

        if (roi >= 30) {
          await ctx.telegram.sendMessage(chatReferenceId, message)
        }

        await sleep(7_000)
      }
    } catch (error) {
      JOBS[chatReferenceId]?.cancel()

      console.log('Something went wrong: ', error)

      await ctx.telegram.sendMessage(chatReferenceId, error.message)
    }
  })

  await ctx.telegram.sendMessage(chatReferenceId, `Bot Started working`)
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
