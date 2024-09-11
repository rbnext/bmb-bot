import { MessageType, Source, Sticker } from './types'

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const median = (array: number[]): number => {
  const sorted = Array.from(array).sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

export const isLessThanThreshold = (aPrice: number, bPrice: number, threshold = 1) => {
  const priceDifference = Math.abs(aPrice - bPrice)
  const roundedDifference = Math.round(priceDifference * 100) / 100

  return roundedDifference < threshold
}

export const priceDiff = (reference: number, current: number) => {
  return Number((((reference - current) / reference) * 100).toFixed(2))
}

export const getTotalStickerPrice = (stickers: Sticker[], start = 0): number => {
  return stickers.reduce((acc, { wear, sell_reference_price }) => {
    return wear === 0 ? acc + Number(sell_reference_price) : acc
  }, start)
}

const messageTypeMapper = {
  [MessageType.Purchased]: '✅',
  [MessageType.Review]: '🔶',
  [MessageType.Bargain]: '🤝',
}

export const generateMessage = ({
  id,
  name,
  type,
  price,
  steamPrice,
  referencePrice,
  medianPrice,
  estimatedProfit,
  source,
  stickerValue = 0,
  float,
  bargainPrice,
}: {
  id: number
  name: string
  type: MessageType
  price: number
  steamPrice?: number
  referencePrice?: number
  medianPrice?: number
  estimatedProfit?: number
  source: Source
  stickerValue?: number
  float?: string
  bargainPrice?: string
}) => {
  const message: string[] = []

  message.push(messageTypeMapper[type] + ' ')
  message.push(`<b>[${type}][${source}]</b> <a href="https://buff.market/market/goods/${id}">${name}</a>\n\n`)

  message.push(`<b>Price</b>: $${price}\n`)

  if (steamPrice) {
    message.push(`<b>Steam price</b>: $${steamPrice}\n`)
  }

  if (referencePrice) {
    message.push(`<b>Reference price</b>: $${referencePrice}\n`)
  }

  if (estimatedProfit && medianPrice) {
    message.push(`<b>Estimated profit</b>: ${estimatedProfit.toFixed(2)}% (if sold for $${medianPrice.toFixed(2)})\n`)
  }

  if (float) {
    message.push(`<b>Float</b>: ${float}\n`)
  }

  if (stickerValue > 0) {
    message.push(`<b>Sticker Value</b>: $${stickerValue.toFixed(2)}\n`)
  }

  if (bargainPrice) {
    message.push(`<b>Bargain price</b>: $${bargainPrice}\n`)
  }

  return message.join('')
}
