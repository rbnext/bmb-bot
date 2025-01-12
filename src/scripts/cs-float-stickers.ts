import 'dotenv/config'

import { sleep } from '../utils'
import { getCSFloatListings } from '../api/csfloat'

import path from 'path'
import { readFileSync, writeFileSync } from 'fs'

const csFloatCharms = async () => {
  const pages = Array.from({ length: 10 }, (_, i) => 3790 + i)

  try {
    for (const id of pages) {
      const response = await getCSFloatListings({ stickers: `[{"i":${id}}]` })
      const pathname = path.join(__dirname, '../../csfloat.json')
      const stickerData: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))
      for (const data of response.data) {
        for (const sticker of data.item?.stickers ?? []) {
          if (sticker.reference?.price && sticker.name.includes('Sticker')) {
            const price = Number((sticker.reference.price / 100).toFixed(2))
            if (price > 0.01) stickerData[sticker.name] = price
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
