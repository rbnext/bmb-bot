import 'dotenv/config'

import { getGoodsInfo, getMarketGoods, getMarketGoodsBillOrder } from './api/buff'
import { getDifferenceInMinutes, median, sleep } from './utils'
import path from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { getMarketHashNameHistory } from './api/csfloat'
import { differenceInMinutes } from 'date-fns'

const init = async () => {
  const response = await getMarketHashNameHistory({
    market_hash_name: 'AK-47 | Redline (Field-Tested)',
  })

  const filteredResponse = response.filter((item) => {
    const floatValue = Number(item.item.float_value.toFixed(2))
    const stickerTotal = (item.item.stickers ?? []).reduce((acc, current) => acc + current.reference.price / 100, 0)

    return stickerTotal <= 5 && floatValue !== 0.15 && floatValue !== 0.16 && floatValue !== 0.17
  })

  console.log(filteredResponse.map((item) => item.price / 100))
}

init()
