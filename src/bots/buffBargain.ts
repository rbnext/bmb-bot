import 'dotenv/config'

import { differenceInDays, format } from 'date-fns'

import {
  getCreatePreviewBargain,
  getGoodsInfo,
  getGoodsSellOrder,
  getMarketGoods,
  getMarketGoodsBillOrder,
  getSentBargain,
  getUserStorePopup,
  postCancelBargain,
  postCreateBargain,
} from '../api/buff'
import { generateMessage, median, sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { BARGAIN_MIN_PRICE, BARGAIN_PROFIT_THRESHOLD, GOODS_SALES_THRESHOLD, REFERENCE_DIFF_THRESHOLD } from '../config'
import { MessageType, Source } from '../types'

const SENT_BARGAINS: string[] = []

const buffBargain = async () => {
  const pages = Array.from({ length: 3 }, (_, i) => i + 1)

  try {
    const bargains = await getSentBargain({})

    for (const bargain of bargains.data.items) {
      if (bargain.state === 1 && bargain.can_cancel_timeout <= -1) {
        await sleep(5_000)
        await postCancelBargain({ bargain_id: bargain.id })
      }
    }

    await sleep(20_000)

    for (const page_num of pages) {
      await sleep(20_000)
      const goods = await getMarketGoods({
        page_num,
        sort_by: 'sell_num.desc',
        category_group: 'pistol,smg,shotgun,machinegun',
      })

      for (const item of goods.data.items) {
        const goods_id = item.id
        const name = item.market_hash_name

        await sleep(5_000)
        const history = await getMarketGoodsBillOrder({ goods_id: item.id })

        const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
          return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
        })

        if (GOODS_SALES_THRESHOLD > salesLastWeek.length) {
          continue
        }

        await sleep(5_000)
        const goodsInfo = await getGoodsInfo({ goods_id })
        const goods_ref_price = Number(goodsInfo.data.goods_info.goods_ref_price)

        await sleep(5_000)
        const response = await getGoodsSellOrder({ goods_id, exclude_current_user: 1 })
        const items = response.data.items.slice(0, 3)

        for (const item of items) {
          const current_price = Number(item.price)
          const float = Number(item.asset_info.paintwear)
          const sales = salesLastWeek.map(({ price }) => Number(price))
          const median_price = median(sales.filter((price) => current_price * 2 > price))
          const desired_price = Number((median_price - (median_price * BARGAIN_PROFIT_THRESHOLD) / 100).toFixed(2))
          const reference_price_diff = (goods_ref_price / desired_price - 1) * 100
          const lowest_bargain_price = Number(item.lowest_bargain_price)
          const now = format(new Date(), 'HH:mm:ss')

          if (
            !item.allow_bargain ||
            current_price < BARGAIN_MIN_PRICE ||
            lowest_bargain_price > desired_price ||
            reference_price_diff < REFERENCE_DIFF_THRESHOLD ||
            SENT_BARGAINS.includes(item.id) ||
            current_price - desired_price < 2
          ) {
            continue
          }

          if (item.asset_info.paintwear) {
            if (
              (float > 0.12 && float < 0.15) ||
              (float > 0.3 && float < 0.38) ||
              (float > 0.41 && float < 0.45) ||
              float > 0.5
            ) {
              continue
            }
          }

          await sleep(5_000)
          const user = await getUserStorePopup({ user_id: item.user_id })

          if (user.code !== 'OK') {
            await sendMessage(JSON.stringify(user))

            continue
          }

          if (user.data.bookmark_count > 2) {
            continue
          }

          await sleep(5_000)
          const previewBargain = await getCreatePreviewBargain({
            sell_order_id: item.id,
            price: desired_price,
          })

          const pay_confirm = previewBargain?.data?.pay_confirm?.id

          if (previewBargain.code !== 'OK' || pay_confirm === 'bargain_higher_price') {
            console.log(`${now}: Failed. Reason(preview): ${previewBargain.code ?? pay_confirm}`)
            SENT_BARGAINS.push(item.id)

            continue
          }

          const pay_methods = previewBargain?.data?.pay_methods ?? []
          const desired_pay_method = pay_methods.find((item) => item.value === 12)

          if (desired_pay_method && !desired_pay_method.enough) {
            console.log(`${now}: Failed. Reason(preview): ${desired_pay_method.error}`)

            throw new Error('deposit')
          }

          await sleep(5_000)
          const createBargain = await postCreateBargain({ sell_order_id: item.id, price: desired_price })

          if (createBargain.code !== 'OK') {
            console.log(`${now}: Failed. Reason(create): ${createBargain.code}`)

            continue
          }

          const payload = {
            id: goods_id,
            price: desired_price,
            name: name,
            type: MessageType.Bargain,
            source: Source.BUFF_BARGAIN,
            medianPrice: median_price,
            estimatedProfit: BARGAIN_PROFIT_THRESHOLD,
            referencePrice: goods_ref_price,
            float: item.asset_info.paintwear,
          }

          await sendMessage(generateMessage(payload))

          SENT_BARGAINS.push(item.id)
        }
      }

      await sleep(5_000)
    }
  } catch (error) {
    if (error.message !== 'deposit') {
      console.log('Something went wrong', error)
      await sendMessage(error?.message ?? 'Something went wrong.')

      return
    }
  }

  await sleep(1_000 * 60 * 10)

  buffBargain()
}

;(async () => {
  const pages = Array.from({ length: 5 }, (_, i) => i + 1)

  for (const page_num of pages) {
    const bargains = await getSentBargain({ page_num })

    for (const bargain of bargains.data.items) {
      SENT_BARGAINS.push(bargain.sell_order_id)
    }

    await sleep(10_000)
  }

  buffBargain()
})()
