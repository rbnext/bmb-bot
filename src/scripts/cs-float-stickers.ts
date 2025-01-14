import 'dotenv/config'

import { sleep } from '../utils'
import { getCSFloatListings } from '../api/csfloat'

import path from 'path'
import { readFileSync, writeFileSync } from 'fs'

const csFloatCharms = async () => {
  const pages = Array.from({ length: 15 }, (_, i) => 3000 + i)
  const groups = ['C2057', 'C1545', 'C1673', 'C1801', 'C1289', 'C521', 'C1417', 'C905', 'C1929', 'C393']

  // const pathname = path.join(__dirname, '../../csfloat.json')
  // const stickerData: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))
  // for (const sticker of Object.keys(stickerData)) {
  //   if (stickerData[sticker] === 0.03) delete stickerData[sticker]
  // }
  // writeFileSync(pathname, JSON.stringify({ ...stickerData }, null, 4))

  try {
    for (const id of groups) {
      const response = await getCSFloatListings({ stickers: `[{"c":"${id}"}]` }) // c - groups; i - sticker id
      const pathname = path.join(__dirname, '../../csfloat.json')
      const stickerData: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))
      for (const data of response.data) {
        for (const sticker of data.item?.stickers ?? []) {
          if (sticker.reference?.price && sticker.name.includes('Sticker')) {
            const price = Number((sticker.reference.price / 100).toFixed(2))
            if (price >= 0.05) stickerData[sticker.name] = price
          }
        }
      }
      console.log(Object.keys(stickerData).length)
      writeFileSync(pathname, JSON.stringify({ ...stickerData }, null, 4))
      await sleep(5_000)
    }
  } catch (error) {
    console.log('Something went wrong', error)
  }
}

csFloatCharms()
