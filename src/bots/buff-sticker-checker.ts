import dotenv from 'dotenv'

dotenv.config()

import { getGoodsSellOrder, getMarketGoods } from '../api/buff'
import { sleep } from '../utils'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'

let cursor: string = ''

const buffSteam = async () => {
  try {
    const marketGoods = await getMarketGoods({
      min_price: Number(process.env.MIN_BARGAIN_PRICE),
      max_price: Number(process.env.MAX_BARGAIN_PRICE),
      category_group: 'rifle,pistol,smg,shotgun,machinegun',
    })

    const cursorIndex = marketGoods.data.items.findIndex((item) => (cursor ? item.market_hash_name === cursor : false))
    const filteredItems = marketGoods.data.items.slice(0, cursorIndex === -1 ? 0 : cursorIndex)

    for (const item of filteredItems) {
      const latestOrders = await getGoodsSellOrder({
        goods_id: item.id,
        exclude_current_user: 1,
        sort_by: 'created.desc',
      })

      const latestOrderItem = latestOrders.data.items[0]
      const stickerTotal = (latestOrderItem.asset_info.info?.stickers || []).reduce((acc, sticker) => {
        return sticker.wear === 0 ? acc + Number(sticker.sell_reference_price) : acc
      }, 0)

      if (typeof latestOrderItem.sticker_premium === 'number') {
        const now = format(new Date(), 'HH:mm:ss')
        const stickerPremium = Number((latestOrderItem.sticker_premium * 100).toFixed(1))

        console.log(now, item.market_hash_name, stickerTotal, latestOrderItem.sticker_premium)

        if (stickerTotal > 10 && latestOrderItem.sticker_premium < 0.1) {
          await sendMessage({
            text: `<a href="https://buff.market/market/goods/${item.id}">${item.market_hash_name}</a> $${stickerTotal.toFixed(1)} SP: ${stickerPremium}%`,
          })
        }
      }

      await sleep(1_000)
    }

    cursor = marketGoods.data.items[0].market_hash_name

    await sleep(2_500)
  } catch (error) {
    console.log('Something went wrong', error)

    if (error.message !== 'Request failed with status code 503') {
      await sendMessage({ text: error?.message ?? 'Something went wrong.' })

      return
    }

    await sendMessage({ text: `${error.message}. Restarting in 60 seconds...` })
    await sleep(60_000)
  }

  buffSteam()
}

buffSteam()
