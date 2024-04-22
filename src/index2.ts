import { Context, Telegraf } from 'telegraf'
import schedule from 'node-schedule'

import { getBriefAsset } from './api/buff'
import { sleep } from './utils'
import { buff2steam } from './buff2steam'
import { weaponCases } from './config'

const JOBS: Record<string, schedule.Job> = {}

const bot = new Telegraf(process.env.BOT_TOKEN as string)

bot.command('start', async (ctx: Context) => {
  const briefAsset = await getBriefAsset()

  const chatReferenceId = ctx.message!.chat.id

  let totalAmount = Number(briefAsset.data.total_amount)

  await ctx.telegram.sendMessage(chatReferenceId, 'Starting...')
  await ctx.telegram.sendMessage(chatReferenceId, `Buff account balance: ${totalAmount}$`)

  JOBS[chatReferenceId]?.cancel()

  JOBS[chatReferenceId] = schedule.scheduleJob('*/10 * * * *', async () => {
    const logger = async ({ message, error }: { message: string; error?: boolean }) => {
      if (error) JOBS[chatReferenceId]?.cancel()

      await ctx.telegram.sendMessage(chatReferenceId, message)
    }

    try {
      const all = { sort_by: 'sell_num.desc', min_price: 1, max_price: 4 }
      const cases = { category: 'csgo_type_weaponcase', itemset: weaponCases.join(',') }

      await buff2steam({ params: cases, pagesToLoad: 1, logger })

      await sleep(10_000)

      await buff2steam({ params: all, pagesToLoad: 25, logger })
    } catch (error) {
      JOBS[chatReferenceId]?.cancel()

      console.log('Something went wrong: ', error)

      await ctx.telegram.sendMessage(chatReferenceId, error.message)
    }
  })
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
