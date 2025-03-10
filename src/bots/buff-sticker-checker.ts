import dotenv from 'dotenv'

dotenv.config()

import { getGoodsSellOrder, getMarketGoods, postGoodsBuy } from '../api/buff'
import { generateMessage, sleep } from '../utils'
import { differenceInHours, format } from 'date-fns'
import { sendMessage, sendPhoto } from '../api/telegram'
import { getCSFloatListings, getMarketHashNameHistory } from '../api/csfloat'
import { MessageType, Source } from '../types'
import { toZonedTime } from 'date-fns-tz'

let cursor: string = ''

const roundUp = (num: number) => Math.ceil(num * 100) / 100

const buffSteam = async () => {
  try {
    const marketGoods = await getMarketGoods({
      min_price: Number(process.env.MIN_BARGAIN_PRICE),
      max_price: Number(process.env.MAX_BARGAIN_PRICE),
      category_group: 'rifle,pistol,smg,shotgun,machinegun',
      exterior: 'wearcategory0,wearcategory1,wearcategory2',
    })

    const cursorIndex = marketGoods.data.items.findIndex((item) => (cursor ? item.market_hash_name === cursor : false))
    const filteredItems = marketGoods.data.items.slice(0, cursorIndex === -1 ? 0 : cursorIndex)

    for (const item of filteredItems) {
      const market_hash_name = item.market_hash_name

      const latestOrders = await getGoodsSellOrder({
        goods_id: item.id,
        exclude_current_user: 1,
        sort_by: 'created.desc',
      })

      const now = format(new Date(), 'HH:mm:ss')

      const latestOrderItem = latestOrders.data.items[0]

      const currentPrice = Number(latestOrderItem.price)
      const itemFloatValue = Number(latestOrderItem.asset_info.paintwear ?? 0)

      const stickerTotal = (latestOrderItem.asset_info.info?.stickers || []).reduce((acc, sticker) => {
        return sticker.wear === 0 ? acc + Number(sticker.sell_reference_price) : acc
      }, 0)

      const payload = {
        id: item.id,
        float: itemFloatValue,
        price: currentPrice,
        type: MessageType.Review,
        name: item.market_hash_name,
        source: Source.BUFF_CSFLOAT,
        stickerTotal: stickerTotal,
      }

      if (
        stickerTotal > 10 &&
        Number(item.sell_min_price) * 2 > Number(latestOrderItem.price) &&
        typeof latestOrderItem.sticker_premium === 'number' &&
        latestOrderItem.sticker_premium < 0.1
      ) {
        const stickerPremium = Number((latestOrderItem.sticker_premium * 100).toFixed(1))

        const response = await sendMessage({
          text: `<a href="https://buff.market/market/goods/${item.id}">${item.market_hash_name}</a> $${stickerTotal.toFixed(1)} SP: ${stickerPremium}%`,
        })

        if (latestOrderItem.img_src?.includes('ovspect')) {
          await sendPhoto({
            photo: latestOrderItem.img_src.replace('/q/75', '/q/100'),
            reply_to_message_id: response.result.message_id,
          })
        }
      } else if (
        (market_hash_name.includes('Factory New') && itemFloatValue > 0 && itemFloatValue < 0.02) ||
        (market_hash_name.includes('Minimal Wear') && itemFloatValue > 0 && itemFloatValue < 0.08) ||
        (market_hash_name.includes('Field-Tested') && itemFloatValue > 0 && itemFloatValue < 0.17)
      ) {
        // const marketHistoryResponse = await getMarketHashNameHistory({ market_hash_name })
        // const response = await getCSFloatListings({
        //   market_hash_name,
        //   ...(market_hash_name.includes('Factory New') && { max_float: roundUp(itemFloatValue) }),
        //   ...(market_hash_name.includes('Minimal Wear') && { max_float: roundUp(itemFloatValue) }),
        //   ...(market_hash_name.includes('Field-Tested') && { max_float: roundUp(itemFloatValue) }),
        // })
        // if (response.data.length === 0) {
        //   continue
        // }
        // const sales48h = marketHistoryResponse.filter((item) => {
        //   return differenceInHours(new Date(), toZonedTime(item.sold_at, 'Europe/Warsaw')) < 24 * 2
        // })
        // const lowestFloatPrice = response.data[0].price / 100
        // const estimatedProfit = Number((((lowestFloatPrice - currentPrice) / currentPrice) * 100).toFixed(2))
        // if (sales48h.length >= 10 && estimatedProfit >= 20) {
        //   sendMessage({ text: generateMessage(payload) })
        // } else {
        //   console.log(now, item.market_hash_name, estimatedProfit.toFixed(1) + '%', itemFloatValue)
        // }
      }

      console.log(now, item.market_hash_name, '$' + latestOrderItem.price)

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
