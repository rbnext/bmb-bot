import { differenceInMinutes, formatDistance, isAfter, subHours, subMinutes } from 'date-fns'
import {
  CSFloatListing,
  KeychainItem,
  MessageType,
  ShopBillOrderItem,
  Source,
  SteamInventoryHelperSticker,
} from './types'

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const median = (array: number[]): number => {
  const sorted = Array.from(array).sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (array.length === 0) return 0
  if (sorted.length % 2 === 0) return (sorted[middle - 1] + sorted[middle]) / 2

  return sorted[middle]
}

export const isLessThanXHours = (date: number, hours = 24) => {
  return isAfter(new Date(date * 1000), subHours(new Date(), hours))
}

export const isLessThanXMinutes = (date: number, minutes = 1) => {
  return isAfter(new Date(date * 1000), subMinutes(new Date(), minutes))
}

export const getDifferenceInMinutes = (date1: number, date2: number): number => {
  return differenceInMinutes(new Date(date1 * 1_000), new Date(date2 * 1_000))
}

export const isLessThanThreshold = (aPrice: number, bPrice: number, threshold = 1) => {
  const priceDifference = Math.abs(aPrice - bPrice)
  const roundedDifference = Math.round(priceDifference * 100) / 100

  return roundedDifference < threshold
}

const messageTypeMapper = {
  [MessageType.Purchased]: '✅',
  [MessageType.Review]: '🔶',
  [MessageType.Bargain]: '🤝',
  [MessageType.ManualBargain]: '❗',
}

export const generateSteamMessage = ({
  id,
  name,
  price,
  float,
  stickers = [],
  stickerTotal,
  position,
  templateId,
  estimatedProfit,
  referencePrice,
  buffFirstPrice,
  inspectLink,
  ratio,
  details = {},
}: {
  name: string
  price: number
  float?: number
  stickers?: SteamInventoryHelperSticker[] | string[]
  stickerTotal?: number
  position: number
  templateId?: number | null
  estimatedProfit?: number
  referencePrice?: number
  buffFirstPrice?: number
  id?: number
  ratio?: number
  details?: Record<string, number>
  inspectLink?: string
}) => {
  const message: string[] = []

  const steamUrl = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(name)}`

  message.push(`<a href="${steamUrl}">${name}</a> | #${position}\n\n`)

  for (const sticker of stickers) {
    if (typeof sticker === 'string') {
      message.push(`<b>Sticker | ${sticker}</b>: ${details[sticker] ? `$${details[sticker]}` : 'n/a'} \n`)
    } else {
      message.push(`<b>${sticker.name}</b>: ${sticker.wear === 0 ? '100%' : `${sticker.wear.toFixed(2)}%`}\n`)
    }
  }

  message.push(`\n`)

  if (price) {
    message.push(
      `<b>Steam price</b>: $${price.toFixed(2)} ${estimatedProfit ? `(${estimatedProfit.toFixed(2)}%)` : ''}\n`
    )
  }
  if (referencePrice) message.push(`<b>Reference price</b>: $${referencePrice.toFixed(2)}\n`)
  if (stickerTotal) message.push(`<b>Sticker total price</b>: $${stickerTotal.toFixed(2)}\n\n`)

  if (templateId) message.push(`<b>Template ID</b>: ${templateId}\n`)
  if (ratio) message.push(`<b>Ratio</b>: ${ratio.toFixed(2)}\n`)

  if (stickers.length !== 0) {
    message.push(
      `<a href="${steamUrl}?filter=${stickers.join(',')}">FAST OPEN</a> | <a href="https://screenshot.skinport.com/?link=${inspectLink}">INSPECT</a>`
    )
  }

  return message.join('')
}

export const generateMessage = ({
  id,
  name,
  type,
  price,
  steamPrice,
  referencePrice,
  userAcceptBargains,
  userId,
  medianPrice,
  estimatedProfit,
  stickerPremium,
  source,
  stickerTotal = 0,
  createdAt,
  updatedAt,
  float,
  bargainPrice,
  refPriceDelta,
  positions,
  keychain,
  csFloatPrice,
  pattern,
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
  createdAt?: number
  refPriceDelta?: number
  userAcceptBargains?: boolean
  userId?: string
  updatedAt?: number
  stickerTotal?: number
  float?: string
  bargainPrice?: number
  stickerPremium?: number
  positions?: number
  keychain?: KeychainItem
  csFloatPrice?: number
  pattern?: number
}) => {
  const message: string[] = []

  const options = { addSuffix: true, includeSeconds: true }

  message.push(messageTypeMapper[type] + ' ')
  message.push(`<b>[${type}][${source}]</b> <a href="https://buff.market/market/goods/${id}">${name}</a>\n\n`)

  if (bargainPrice) message.push(`<b>Price</b>: <s>$${price}</s> $${bargainPrice}\n`)
  else message.push(`<b>Price</b>: $${price}\n`)

  if (csFloatPrice) {
    message.push(`<b>CS Float price</b>: $${csFloatPrice.toFixed(2)}\n`)
  }

  if (steamPrice) {
    message.push(`<b>Steam price</b>: $${steamPrice}\n`)
  }

  if (referencePrice && refPriceDelta) {
    message.push(`<b>Reference price</b>: $${referencePrice} (${refPriceDelta.toFixed(2)}%)\n`)
  }

  if (createdAt) {
    message.push(`<b>Created at</b>: ${formatDistance(new Date(createdAt * 1000), new Date(), options)}\n`)
  }

  if (updatedAt) {
    message.push(`<b>Updated at</b>: ${formatDistance(new Date(updatedAt * 1000), new Date(), options)}\n`)
  }

  if (estimatedProfit && medianPrice) {
    message.push(`<b>Estimated profit</b>: ${estimatedProfit.toFixed(2)}% (if sold for $${medianPrice.toFixed(2)})\n`)
  }

  if (typeof positions === 'number') {
    message.push(`<b>Positions between median and current price</b>: ${positions}\n`)
  }

  if (float) {
    message.push(`<b>Float</b>: ${float}\n`)
  }

  if (stickerTotal) {
    message.push(`<b>Sticker total</b>: ~$${stickerTotal.toFixed(2)}\n`)
  }

  if (pattern) {
    message.push(`<b>Pattern</b>: ${pattern}\n`)
  }

  if (keychain) {
    message.push(`<b>Keychain</b>: ${keychain.name} ($${keychain.sell_reference_price})\n`)
  }

  if (stickerPremium) {
    message.push(`<b>Sticker premium</b>: ${stickerPremium}%\n`)
  }

  if (userId && userAcceptBargains) {
    message.push(
      `<b><a href="https://buff.market/user_store/${userId}/selling">${userId}</a> accept bargains</b>: YES\n`
    )
  }

  return message.join('')
}

export const getBargainDiscountPrice = (price: number, userSellingHistory: ShopBillOrderItem[]) => {
  const history = userSellingHistory.filter((item) => item.has_bargain)
  const percents = history.map((item) => (Number(item.original_price) / Number(item.price) - 1) * 100)

  return Number((price - price * ((median(percents) > 8 ? 10.5 : 5) / 100)).toFixed(2))
}

export function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function extractStickers(input: string): string[] {
  let match

  const stickers: string[] = []
  const titleRegex = /title="([^"]+)"/g

  while ((match = titleRegex.exec(input)) !== null) stickers.push(match[1])

  return stickers.map((name) => name.replace('Sticker: ', ''))
}

export const getItemExterior = (market_hash_name: string) => {
  const isStatTrak = market_hash_name.includes('StatTrak™')

  const isFactoryNew = market_hash_name.includes('Factory New')
  const isMinimalWear = market_hash_name.includes('Minimal Wear')
  const isFieldTested = market_hash_name.includes('Field-Tested')
  const isWellWorn = market_hash_name.includes('Well-Worn')
  const isBattleScarred = market_hash_name.includes('Battle-Scarred')

  return {
    isStatTrak,
    isFactoryNew,
    isMinimalWear,
    isFieldTested,
    isWellWorn,
    isBattleScarred,
  }
}

export const getCSFloatItemPrice = (item: CSFloatListing): number => {
  if (!item?.data?.[0]) {
    return 0
  }

  return Math.min(item.data[0].price, item.data[0].reference.predicted_price) / 100
}

export const getSteamUrl = (market_hash_name: string, stickers: string[]) => {
  const filter = stickers.map((name) => `Sticker | ${name}`).join(',')

  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(market_hash_name)}?filter=${filter}`
}
