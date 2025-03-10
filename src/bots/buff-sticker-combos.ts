import 'dotenv/config'

import { getStickerCombos } from '../api/buff'
import { sleep } from '../utils'
import { format } from 'date-fns'
import { sendMessage } from '../api/telegram'
import { getMaxPricesForXDays } from '../helpers/getMaxPricesForXDays'

const CASHED_LISTINGS = new Set<string>()

const buffSteam = async () => {
  try {
    const marketGoods = await getStickerCombos({ max_price: 20 })

    for (const item of marketGoods.data.items) {
      const now = format(new Date(), 'HH:mm:ss')
      const market_hash_name = marketGoods.data.goods_infos[item.goods_id].market_hash_name

      if (CASHED_LISTINGS.has(item.id)) {
        continue
      }

      const stickerTotal = (item.asset_info.info?.stickers || []).reduce((acc, sticker) => {
        return sticker.wear === 0 ? acc + Number(sticker.sell_reference_price) : acc
      }, 0)

      if (
        stickerTotal > 4 &&
        stickerTotal < 40 &&
        typeof item.sticker_premium === 'number' &&
        item.sticker_premium < 0.01
      ) {
        const prices = await getMaxPricesForXDays(market_hash_name)
        const minSteamPrice = prices.length !== 0 ? Math.min(...prices) : 0

        const messages: string[] = []

        messages.push(
          `<b>[STEAM_COMBOS]</b> <a href="https://buff.market/market/goods/${item.goods_id}">${market_hash_name}</a>\n\n`
        )
        messages.push(`<b>Price</b>: $${item.price}\n`)
        messages.push(`<b>Steam price:</b>: $${minSteamPrice.toFixed(2)}\n`)
        messages.push(`<b>Combo total:</b>: $${stickerTotal.toFixed(2)}\n\n`)

        for (const sticker of item.asset_info.info?.stickers ?? []) {
          messages.push(`<b>${sticker.name}</b>: $${sticker.sell_reference_price}\n`)
        }

        await sendMessage({ text: messages.join('') })
      }

      console.log(`${now}: ${market_hash_name} $${stickerTotal}`)

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

  buffSteam()
}

buffSteam()
