import { Telegraf } from 'telegraf'
import schedule from 'node-schedule'

import { getMarketGoods } from './api/buff'
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

      for (const {
        id,
        sell_min_price,
        market_hash_name,
        goods_info: { steam_price },
      } of response.data.items) {
        const roi = ((+steam_price * 0.87) / +sell_min_price - 1) * 100

        const message = `Item "${market_hash_name}". Buff: ${sell_min_price}$ | Steam: ${steam_price}$ | ROI: ${roi.toFixed(2)}%\nhttps://buff.market/market/goods/${id}?game=csgo`

        if (roi >= 30) {
          await ctx.telegram.sendMessage(chatReferenceId, message)
          await sleep(5_000)
        }
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
