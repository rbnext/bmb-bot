import 'dotenv/config'

import { sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { getBuyOrders } from '../api/csfloat'

export const GOODS_CACHE: Record<string, { price: number }> = {}

const config = [
  {
    referenceId: '795002736566468718',
    market_hash_name: 'Glock-18 | Gold Toof (Minimal Wear)',
  },
  {
    referenceId: '794975731133317153',
    market_hash_name: 'Glock-18 | Gold Toof (Field-Tested)',
  },
  {
    referenceId: '792840104031946274',
    market_hash_name: 'USP-S | Jawbreaker (Factory New)',
  },
  {
    referenceId: '794147369271820831',
    market_hash_name: 'Sticker | Lurker (Foil)',
  },
  {
    referenceId: '794971306079685810',
    market_hash_name: 'Sticker | Loving Eyes (Holo)',
  },
  {
    referenceId: '795224945847308148',
    market_hash_name: 'Sticker | Natus Vincere | Cologne 2014',
  },
  {
    referenceId: '794691860495990845',
    market_hash_name: 'Souvenir USP-S | Road Rash (Field-Tested)',
  },
  {
    referenceId: '793618248263401922',
    market_hash_name: 'StatTrak™ M4A1-S | Emphorosaur-S (Minimal Wear)',
  },
]

const csPriceChecker = async () => {
  try {
    for (const { referenceId, market_hash_name } of config) {
      const response = await getBuyOrders({ id: referenceId })

      const current_price = response[0].price

      if (market_hash_name in GOODS_CACHE && current_price !== GOODS_CACHE[market_hash_name].price) {
        const prev_price = Number((GOODS_CACHE[market_hash_name].price / 100).toFixed(2))
        const next_price = Number((current_price / 100).toFixed(2))
        await sendMessage(
          `<a href="https://csfloat.com/item/${referenceId}">${market_hash_name}</a> | $${prev_price} -> $${next_price}`
        )
      }

      GOODS_CACHE[market_hash_name] = { price: current_price }

      await sleep(20_000)
    }
  } catch (error) {
    console.log('Something went wrong', error)

    return
  }

  csPriceChecker()
}

csPriceChecker()
