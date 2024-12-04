import 'dotenv/config'

import UserAgent from 'user-agents'
import { SteamMarketConfig } from '../types'
import { getGoodsInfo, getMarketGoods } from '../api/buff'
import { sleep } from '../utils'
import { findSteamItemInfo } from './utils'
import Bottleneck from 'bottleneck'

const CONFIG = [
  {
    market_hash_names: [
      // 'P90 | Asiimov (Field-Tested)',
      // 'Desert Eagle | Mecha Industries (Minimal Wear)',
      // 'AWP | Chromatic Aberration (Field-Tested)',
      // 'Desert Eagle | Conspiracy (Minimal Wear)',
      'AK-47 | Red Laminate (Well-Worn)',
      "M4A1-S | Chantico's Fire (Minimal Wear)",
      'AK-47 | Wasteland Rebel (Field-Tested)',
      'USP-S | Orion (Minimal Wear)',
    ],
    proxy: 'http://S0oH5AJkr2:hCdq69iwKV@185.156.75.160:15017', // ru
  },
  {
    market_hash_names: [
      // 'Desert Eagle | Heat Treated (Minimal Wear)', something wrong with this item!
      // 'M4A4 | 龍王 (Dragon King) (Field-Tested)',
      // 'M4A4 | 龍王 (Dragon King) (Minimal Wear)',
      // 'M4A4 | X-Ray (Minimal Wear)',
      'AK-47 | Bloodsport (Field-Tested)',
      'AK-47 | Wasteland Rebel (Field-Tested)',
      'M4A1-S | Golden Coil (Minimal Wear)',
      'AWP | Chrome Cannon (Factory New)',
    ],
    proxy: 'http://TNJr9sjaxY:wJcQyV6T1o@185.156.75.126:13350', // new ru
  },
  {
    market_hash_names: [
      // 'AK-47 | Phantom Disruptor (Factory New)',
      // 'USP-S | The Traitor (Field-Tested)',
      // 'AWP | Chromatic Aberration (Minimal Wear)',
      // 'AWP | Atheris (Factory New)',
      'AK-47 | Fuel Injector (Well-Worn)',
      'AK-47 | Frontside Misty (Factory New)',
      'AK-47 | The Empress (Factory New)',
      'StatTrak™ AK-47 | Point Disarray (Factory New)',
    ],
    proxy: 'http://L5B6t89Uef:EhqDzFUpJi@194.63.143.13:14362', // new ru
  },
  {
    market_hash_names: [
      // 'AWP | Fever Dream (Field-Tested)',
      // 'M4A4 | The Emperor (Field-Tested)',
      // 'M4A4 | Neo-Noir (Minimal Wear)',
      // 'M4A1-S | Decimator (Field-Tested)',
      'StatTrak™ AK-47 | Point Disarray (Field-Tested)',
      'StatTrak™ M4A1-S | Black Lotus (Factory New)',
      'AK-47 | Aquamarine Revenge (Factory New)',
      'StatTrak™ AWP | Neo-Noir (Minimal Wear)',
    ],
    proxy: 'http://zhDFociVpC:4cjHL08TwR@185.5.251.252:14016', // new ru
  },
  {
    market_hash_names: [
      // 'AK-47 | Blue Laminate (Factory New)',
      // 'M4A4 | Buzz Kill (Minimal Wear)',
      // 'M4A1-S | Basilisk (Factory New)',
      // 'Glock-18 | Water Elemental (Factory New)',
      'AWP | Sun in Leo (Minimal Wear)',
      'Desert Eagle | Golden Koi (Factory New)',
      'AK-47 | Vulcan (Field-Tested)',
      'M4A1-S | Mecha Industries (Minimal Wear)',
    ],
    proxy: 'http://v1NLVgpJBt:axmFWc47sd@185.5.250.21:13626', // new ru
  },
]

const limiter = new Bottleneck({ maxConcurrent: 4 })

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
    await Promise.all(
      MARKET_HASH_NAMES.map((config) => {
        return limiter.schedule(() => findSteamItemInfo(config))
      })
    )

    MARKET_HASH_NAMES.forEach((_, index) => {
      MARKET_HASH_NAMES[index].canSendToTelegram = true
    })

    await sleep(25_000)

    // eslint-disable-next-line no-constant-condition
  } while (true)
})()
