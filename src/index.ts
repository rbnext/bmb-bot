import { Telegraf } from 'telegraf'
import schedule from 'node-schedule'

import { getBriefAsset, getGoodsSellOrder, getMarketGoods, postGoodsBuy } from './api/buff'
import { weaponCases } from './config'
import { sleep } from './utils'

const JOBS: Record<string, schedule.Job> = {}

const bot = new Telegraf(process.env.BOT_TOKEN as string)

bot.command('start', async (ctx) => {
  const briefAsset = await getBriefAsset()

  const chatReferenceId = ctx.message.chat.id

  let totalAmount = Number(briefAsset.data.total_amount)

  await ctx.telegram.sendMessage(chatReferenceId, 'Starting...')
  await ctx.telegram.sendMessage(chatReferenceId, `Buff account balance: ${totalAmount}$`)

  JOBS[chatReferenceId]?.cancel()

  JOBS[chatReferenceId] = schedule.scheduleJob('*/10 * * * *', async () => {
    try {
      const response = await getMarketGoods({ category: 'csgo_type_weaponcase', itemset: weaponCases.join(',') })

      for (const {
        id,
        sell_min_price,
        market_hash_name,
        goods_info: { steam_price },
      } of response.data.items) {
        const roi = ((+steam_price * 0.87) / +sell_min_price - 1) * 100

        if (roi >= 50) {
          const goods = await getGoodsSellOrder({ goods_id: id })

          const filteredGoods = goods.data.items.filter((good) => +good.price === +sell_min_price)

          const successMessage = `Item "${market_hash_name}" has been bought. Buff: ${sell_min_price}$ | Steam: ${steam_price}$ | ROI: ${roi.toFixed(2)}%`
          const failureMessage = `Not enough money to buy the good: "${market_hash_name}"`

          await sleep(1_000)

          for (const filteredGood of filteredGoods) {
            if (totalAmount >= Number(filteredGood.price)) {
              await postGoodsBuy({ sell_order_id: filteredGood.id, price: Number(filteredGood.price) })
              await ctx.telegram.sendMessage(chatReferenceId, successMessage)

              totalAmount -= Number(filteredGood.price)

              await sleep(3_000)

              continue
            }

            await ctx.telegram.sendMessage(chatReferenceId, failureMessage)

            JOBS[chatReferenceId]?.cancel()

            break
          }

          await sleep(5_000)
        }
      }
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
