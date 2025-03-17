import 'dotenv/config'

import { getStickerCombos, postGoodsBuy } from '../api/buff'
import { generateMessage, sleep } from '../utils'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { MessageType, Source } from '../types'
import { getCSFloatListings } from '../api/csfloat'

const CASHED_LISTINGS = new Set<string>()

const buffStickerCombos = async () => {
  try {
    const marketGoods = await getStickerCombos({ max_price: 30 })

    for (const item of marketGoods.data.items) {
      const now = format(new Date(), 'HH:mm:ss')

      const currentPrice = Number(item.price)
      const market_hash_name = marketGoods.data.goods_infos[item.goods_id].market_hash_name
      const stickers = item.asset_info.info?.stickers || []

      if (CASHED_LISTINGS.has(item.id)) {
        continue
      }

      const isZeroWear = stickers.every((sticker) => sticker.wear === 0)
      const isTrueCombo = stickers.every((item) => item.name === stickers[0].name)

      const stickerTotal = stickers.reduce((acc, sticker) => {
        return sticker.wear === 0 ? acc + Number(sticker.sell_reference_price) : acc
      }, 0)

      const payload = {
        id: item.goods_id,
        price: currentPrice,
        float: item.asset_info.paintwear,
        name: market_hash_name,
        source: Source.BUFF_COMBO,
        type: MessageType.Purchased,
        stickerTotal: stickerTotal,
      }

      console.log(`${now}: ${market_hash_name}`, JSON.stringify({ isZeroWear, isTrueCombo, stickerTotal }))

      if (
        isZeroWear &&
        isTrueCombo &&
        stickerTotal > 5 &&
        typeof item.sticker_premium === 'number' &&
        item.sticker_premium < 0.01
      ) {
        const listings = await getCSFloatListings({ market_hash_name })

        const price = listings.data[3].price
        const basePrice = listings.data[0].reference.base_price
        const simpleMedianPrice = Math.min(basePrice, price) / 100
        const medianPrice = simpleMedianPrice + stickerTotal * 0.15
        const estimatedProfit = Number((((medianPrice - currentPrice) / currentPrice) * 100).toFixed(2))

        console.log(`${now}: ${market_hash_name}`, estimatedProfit + '%')

        if (estimatedProfit > 10) {
          const response = await postGoodsBuy({ price: currentPrice, sell_order_id: item.id })

          if (response.code !== 'OK') {
            console.log('Error:', JSON.stringify(response))

            return
          }

          sendMessage({ text: generateMessage({ ...payload, estimatedProfit, medianPrice }) })
        }
      }

      CASHED_LISTINGS.add(item.id)
    }

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

  buffStickerCombos()
}

buffStickerCombos()
