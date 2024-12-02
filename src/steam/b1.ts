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
      'M4A1-S | Nitro (Factory New)',
      'AK-47 | Blue Laminate (Minimal Wear)',
      'M4A1-S | Basilisk (Minimal Wear)',
      'AK-47 | Ice Coaled (Factory New)',
    ],
    proxy: '',
  },
  {
    market_hash_names: [
      'M4A4 | Temukau (Field-Tested)',
      'Desert Eagle | Crimson Web (Field-Tested)',
      'M4A1-S | Blood Tiger (Minimal Wear)',
      'AK-47 | Cartel (Minimal Wear)',
    ],
    proxy: 'http://05b8879f:4809862d7f@192.144.10.226:30013',
  },
  {
    market_hash_names: [
      'AK-47 | Cartel (Field-Tested)',
      'AK-47 | Frontside Misty (Field-Tested)',
      'M4A4 | Bullet Rain (Minimal Wear)',
      'AK-47 | Red Laminate (Field-Tested)',
    ],
    proxy: 'http://44379168:8345796691@192.144.9.27:30013',
  },
  {
    market_hash_names: [
      'USP-S | Blueprint (Factory New)',
      'M4A1-S | Player Two (Field-Tested)',
      'AK-47 | Slate (Factory New)',
      'AK-47 | Slate (Minimal Wear)',
    ],
    proxy: 'http://jqhH85slcm:7NhQuTt8jm@78.153.143.128:11869', // ru
  },
  {
    market_hash_names: [
      'AK-47 | Rat Rod (Minimal Wear)',
      'M4A1-S | Basilisk (Field-Tested)',
      'AK-47 | Legion of Anubis (Field-Tested)',
      'AWP | POP AWP (Minimal Wear)',
    ],
    proxy: 'http://O40vIdkJYS:egrVx2iLvB@194.67.204.16:17206', // ru
  },
  {
    market_hash_names: [
      'AWP | Atheris (Minimal Wear)',
      'AK-47 | Phantom Disruptor (Minimal Wear)',
      'M4A4 | Neo-Noir (Field-Tested)',
      'Glock-18 | Water Elemental (Minimal Wear)',
    ],
    proxy: 'http://8cSG4Tgj0R:qjSxLU7hrg@81.176.239.24:23303', // ru
  },
]

const limiter = new Bottleneck({ maxConcurrent: 4, minTime: 200 })

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
