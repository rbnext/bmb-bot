import 'dotenv/config'

import { sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { getCSFloatListings, getMarketHashNameHistory } from '../api/csfloat'
import path from 'path'
import { readFileSync, writeFileSync } from 'fs'

const csFloatCharms = async () => {
  try {
    const response = await getCSFloatListings({
      sort_by: 'most_recent',
      max_price: 30,
    })

    const pathname = path.join(__dirname, '../../csfloat.json')
    const stickerData: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

    for (const data of response.data) {
      for (const sticker of data.item?.stickers ?? []) {
        if (sticker.reference?.price) {
          stickerData[sticker.name] = Number((sticker.reference.price / 100).toFixed(2))
        }
      }
    }

    console.log(Object.keys(stickerData).length)
    writeFileSync(pathname, JSON.stringify({ ...stickerData }, null, 4))

    // const response = await getMarketHashNameHistory({
    //   market_hash_name: 'Desert Eagle | Heat Treated (Field-Tested)',
    // })

    // const pathname = path.join(__dirname, '../../csfloat.json')
    // const stickerData: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

    // for (const historyItem of response) {
    //   for (const sticker of historyItem.item?.stickers ?? []) {
    //     if (sticker.reference?.price) {
    //       stickerData[sticker.name] = Number((sticker.reference.price / 100).toFixed(2))
    //     }
    //   }
    // }

    // console.log(Object.keys(stickerData).length)
    // writeFileSync(pathname, JSON.stringify({ ...stickerData }, null, 4))
  } catch (error) {
    console.log('Something went wrong', error)

    return
  }
}

csFloatCharms()
