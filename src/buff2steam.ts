import 'dotenv/config'

import { format } from 'date-fns'
import { getMarketGoods } from './api/buff'
import { sleep } from './utils'
import { sendMessage } from './api/telegram'

let lastMarketHashName: string | null = null

const buff2steam = async () => {
  const now = format(new Date(), 'dd MMM yyyy, HH:mm')

  try {
    const marketGoods = await getMarketGoods({ quality: 'normal,strange,tournament', min_price: 1, max_price: 100 })

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

        if (item.sell_num >= 5 && diff > 50) {
          await sendMessage(
            `${item.market_hash_name}\n\n` +
              `Difference with steam: ${diff.toFixed(2)}\n` +
              `https://buff.market/market/goods/${goods_id}`
          )
        }

        await sleep(1_000)
      }

      lastMarketHashName = items[0].market_hash_name
    }
  } catch (error) {
    console.log('Something went wrong', error)

    await sendMessage('Buff default bot is stopped working.')

    return
  }

  await sleep(10_000)

  buff2steam()
}

buff2steam()
