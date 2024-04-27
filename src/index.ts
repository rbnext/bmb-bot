import { Context, Telegraf } from 'telegraf'
import schedule from 'node-schedule'
import { getBriefAsset } from './api/buff'
import { buff2steam } from './buff2steam'
import { weaponCases } from './config'

if (!process.env.BOT_TOKEN) throw new Error('No BOT_TOKEN')
if (!process.env.SESSION_TOKEN) throw new Error('No SESSION_TOKEN')

const JOBS: Record<string, schedule.Job[]> = {}

const bot = new Telegraf(process.env.BOT_TOKEN as string)

bot.command('start', async (ctx: Context) => {
  const briefAsset = await getBriefAsset()
  const chatReferenceId = ctx.message!.chat.id

  console.log(briefAsset)

  let totalAmount = Number(briefAsset.data.total_amount)

  await ctx.telegram.sendMessage(chatReferenceId, 'Starting...')
  await ctx.telegram.sendMessage(chatReferenceId, `Buff account balance: ${totalAmount}$`)

  JOBS[chatReferenceId]?.forEach((job) => job.cancel())
  JOBS[chatReferenceId] = []

  const logger = async ({ message, error }: { message: string; error?: boolean }) => {
    if (error) JOBS[chatReferenceId]?.forEach((job) => job.cancel())

    await ctx.telegram.sendMessage(chatReferenceId, message)
  }

  const job_1 = schedule.scheduleJob('*/1 * * * *', async () => {
    try {
      const params = { category: 'csgo_type_weaponcase', itemset: weaponCases.join(',') }
      await buff2steam({ params, pagesToLoad: 1, logger })
    } catch (error) {
      console.log(error)
      await logger({ message: error.message, error: true })
    }
  })

  JOBS[chatReferenceId].push(job_1)

  // const job_2 = schedule.scheduleJob('*/10 * * * *', async () => {
  //   try {
  //     const params = { category_group: weaponGroups.join(','), sort_by: 'sell_num.desc', min_price: 1, max_price: 4 }
  //     await buff2steam({ params, pagesToLoad: 15, logger })
  //   } catch (error) {
  //     console.log(error)
  //     await logger({ message: error.message, error: true })
  //   }
  // })

  // JOBS[chatReferenceId].push(job_2)
})

bot.command('stop', async (ctx) => {
  JOBS[ctx.message.chat.id]?.forEach((job) => job.cancel())
})

bot.command('quit', async (ctx) => {
  JOBS[ctx.message.chat.id]?.forEach((job) => job.cancel())

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
