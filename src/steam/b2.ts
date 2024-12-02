import 'dotenv/config'

import UserAgent from 'user-agents'
import { SteamMarketConfig } from '../types'
import { getGoodsInfo, getMarketGoods } from '../api/buff'
import { sleep } from '../utils'
import { findSteamItemInfo } from './utils'

const CONFIG = [
  {
    market_hash_names: [
      'P90 | Asiimov (Field-Tested)',
      'Desert Eagle | Mecha Industries (Minimal Wear)',
      'AWP | Chromatic Aberration (Field-Tested)',
      'Desert Eagle | Conspiracy (Minimal Wear)',
    ],
    proxy: 'http://S0oH5AJkr2:hCdq69iwKV@185.156.75.160:15017', // ru
  },
  {
    market_hash_names: [
      'Desert Eagle | Heat Treated (Minimal Wear)',
      'M4A4 | 龍王 (Dragon King) (Field-Tested)',
      'M4A4 | 龍王 (Dragon King) (Minimal Wear)',
      'M4A4 | X-Ray (Minimal Wear)',
    ],
    proxy: 'http://TNJr9sjaxY:wJcQyV6T1o@185.156.75.126:13350', // new ru
  },
  {
    market_hash_names: [
      'AK-47 | Phantom Disruptor (Factory New)',
      'USP-S | The Traitor (Field-Tested)',
      'AWP | Chromatic Aberration (Minimal Wear)',
      'AWP | Atheris (Factory New)',
    ],
    proxy: 'http://L5B6t89Uef:EhqDzFUpJi@194.63.143.13:14362', // new ru
  },
  {
    market_hash_names: [
      'AWP | Fever Dream (Field-Tested)',
      'M4A4 | The Emperor (Field-Tested)',
      'M4A4 | Neo-Noir (Minimal Wear)',
      'M4A1-S | Decimator (Field-Tested)',
    ],
    proxy: 'http://zhDFociVpC:4cjHL08TwR@185.5.251.252:14016', // new ru
  },
  {
    market_hash_names: [
      'AK-47 | Blue Laminate (Factory New)',
      'M4A4 | Buzz Kill (Minimal Wear)',
      'M4A1-S | Basilisk (Factory New)',
      'Glock-18 | Water Elemental (Factory New)',
    ],
    proxy: 'http://v1NLVgpJBt:axmFWc47sd@185.5.250.21:13626', // new ru
  },
]

;(async () => {
  const MARKET_HASH_NAMES: SteamMarketConfig[] = []

  for (const { proxy, market_hash_names } of CONFIG) {
    for (const market_hash_name of market_hash_names) {
      const canSendToTelegram = false
      const userAgent = new UserAgent().toString()

      const goods = await getMarketGoods({ search: market_hash_name })
      const goods_id = goods.data.items.find((el) => el.market_hash_name === market_hash_name)?.id

      if (goods_id) {
        const goodsInfo = await getGoodsInfo({ goods_id })
        const referencePrice = Number(goodsInfo.data.goods_info.goods_ref_price)
        MARKET_HASH_NAMES.push({ proxy, market_hash_name, canSendToTelegram, userAgent, referencePrice })
        console.log(market_hash_name, `$${referencePrice}`)
      }

      await sleep(5_000)
    }
  }

  do {
    for (const config of MARKET_HASH_NAMES) {
      await findSteamItemInfo(config).then(() => sleep(500))
    }

    MARKET_HASH_NAMES.forEach((_, index) => {
      MARKET_HASH_NAMES[index].canSendToTelegram = true
    })

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
