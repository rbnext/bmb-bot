import 'dotenv/config'

import { format } from 'date-fns'
import { getMarketGoods } from '../api/buff'
import { generateMessage, sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { MessageType, Source } from '../types'

let lastMarketHashName: string | null = null

const buff2steam = async () => {
  const now = format(new Date(), 'HH:mm:ss')

  try {
    const marketGoods = await getMarketGoods({ quality: 'normal,strange,tournament', min_price: 0.5, max_price: 50 })

    const items = marketGoods.data.items.slice(0, 4)

    if (!lastMarketHashName) {
      lastMarketHashName = items[0].market_hash_name
    }

    if (lastMarketHashName) {
      for (const item of items) {
        if (item.market_hash_name === lastMarketHashName) {
          break
        }

        const goods_id = item.id
        const current_price = +item.sell_min_price
        const steam_price = +item.goods_info.steam_price

        const diff = ((steam_price - current_price) / current_price) * 100

        console.log(`${now}: ${item.market_hash_name} diff ${diff.toFixed(2)}%`)

        if (diff >= 55) {
          const payload = {
            id: goods_id,
            price: current_price,
            stemPrice: steam_price,
            estimatedProfit: diff,
            medianPrice: steam_price,
            name: item.market_hash_name,
            source: Source.BUFF_STEAM,
            type: MessageType.Review,
          }

          await sendMessage(generateMessage(payload))
        }

        await sleep(1_000)
      }

      lastMarketHashName = items[0].market_hash_name
    }
  } catch (error) {
    console.log('Something went wrong', error)

    await sendMessage(error?.message ?? 'Something went wrong.')

    return
  }

  await sleep(10_000)

  buff2steam()
}

buff2steam()
