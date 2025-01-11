import 'dotenv/config'

import { sleep } from '../utils'
import { sendMessage } from '../api/telegram'
import { getCSFloatListings, getMarketHashNameHistory } from '../api/csfloat'
import { getSearchMarketRender } from '../api/steam'

import path from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { SearchMarketRender } from '../types'

const csFloatCharms = async () => {
  try {
    const response = await getCSFloatListings({
      sort_by: 'most_recent',
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
    // const response: SearchMarketRender = await getSearchMarketRender({
    //   query: 'Sticker',
    //   quality: ['tag_normal'],
    //   start: 750,
    // })
    // for (const item of response.results) {
    //   const response = await getMarketHashNameHistory({
    //     market_hash_name: item.asset_description.market_hash_name,
    //   })
    //   const pathname = path.join(__dirname, '../../csfloat.json')
    //   const stickerData: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))
    //   for (const historyItem of response) {
    //     for (const sticker of historyItem.item?.stickers ?? []) {
    //       if (sticker.reference?.price) {
    //         stickerData[sticker.name] = Number((sticker.reference.price / 100).toFixed(2))
    //       }
    //     }
    //   }
    //   console.log(Object.keys(stickerData).length)
    //   writeFileSync(pathname, JSON.stringify({ ...stickerData }, null, 4))
    //   await sleep(5_000)
    // }
  } catch (error) {
    console.log('Something went wrong', error)

    return
  }
}

csFloatCharms()
