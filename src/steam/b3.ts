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
      'StatTrak™ AWP | Worm God (Factory New)',
      'StatTrak™ USP-S | Guardian (Field-Tested)',
      'StatTrak™ AWP | Atheris (Field-Tested)',
      'StatTrak™ AK-47 | Redline (Field-Tested)',
    ],
    proxy: 'http://qGn9RrE0X7:TZyw6rLK8J@193.0.203.191:25884',
  },
  {
    market_hash_names: [
      'StatTrak™ M4A4 | Evil Daimyo (Factory New)',
      'StatTrak™ USP-S | Guardian (Minimal Wear)',
      'StatTrak™ USP-S | Guardian (Factory New)',
      'StatTrak™ AK-47 | Ice Coaled (Field-Tested)',
    ],
    proxy: 'http://q0oWZ1Lf6k:PTzoiIkfsc@193.0.202.126:10115',
  },
  {
    market_hash_names: [
      'StatTrak™ AK-47 | Phantom Disruptor (Field-Tested)',
      'StatTrak™ USP-S | Cyrex (Factory New)',
      'StatTrak™ AK-47 | Slate (Field-Tested)',
      'StatTrak™ Desert Eagle | Crimson Web (Field-Tested)',
    ],
    proxy: 'http://JCxKRYa8D3:2Fi04EpMtk@185.5.251.103:23827',
  },
  {
    market_hash_names: [
      'StatTrak™ M4A1-S | Decimator (Field-Tested)',
      'StatTrak™ AK-47 | Blue Laminate (Minimal Wear)',
      'StatTrak™ AK-47 | Slate (Minimal Wear)',
      'StatTrak™ AK-47 | Ice Coaled (Minimal Wear)',
    ],
    proxy: 'http://nIrTWYLq2i:S1onG2mUiC@194.63.143.29:14674',
  },
  {
    market_hash_names: [
      'StatTrak™ AWP | Atheris (Minimal Wear)',
      'StatTrak™ AK-47 | Blue Laminate (Field-Tested)',
      'StatTrak™ AK-47 | Blue Laminate (Factory New)',
      'StatTrak™ AK-47 | Slate (Factory New)',
    ],
    proxy: 'http://1waKEmCL0q:sh5gGkNjnA@193.0.200.21:14453',
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
        MARKET_HASH_NAMES.push({ proxy, market_hash_name, canSendToTelegram, userAgent, referencePrice: 0 })
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
