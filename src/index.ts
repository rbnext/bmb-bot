import 'dotenv/config'

import { Context, Telegraf } from 'telegraf'
import schedule from 'node-schedule'
import { getBriefAsset } from './api/buff'
import { buff2buff } from './buff2buff'

export const JOBS: Record<string, schedule.Job> = {}

const bot = new Telegraf(process.env.BOT_TOKEN as string)

bot.command('start', async (ctx: Context) => {
  const briefAsset = await getBriefAsset()
  const chatReferenceId = ctx.message!.chat.id

  const totalAmount = Number(briefAsset.data.cash_amount)

  await ctx.telegram.sendMessage(chatReferenceId, 'Starting...')
  await ctx.telegram.sendMessage(chatReferenceId, `Buff account balance: ${totalAmount}$`)

  JOBS[chatReferenceId]?.cancel()

  JOBS[chatReferenceId] = schedule.scheduleJob('*/3 * * * *', buff2buff(ctx))
})

bot.command('stop', async (ctx) => {
  JOBS[ctx.message.chat.id].cancel()
})

bot.command('quit', async (ctx) => {
  JOBS[ctx.message.chat.id].cancel()

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
