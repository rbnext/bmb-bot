import { MarketPriceOverview } from './types'

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const stringToNumber = (str: string) => Number(str.replace(/[a-zA-Z$ ]/g, ''))

export const calculateROI = (maxPrice: number, minPrice: number, fee: number = 13) => {
  return ((maxPrice * 0.87) / minPrice - 1) * 100
}

export const canMakePurchase = ({
  minVolume = 50,
  sellMinPrice,
  marketOverview,
}: {
  minVolume: number
  sellMinPrice: number
  marketOverview: MarketPriceOverview
}) => {
  if (
    !marketOverview.success ||
    !marketOverview.lowest_price ||
    !marketOverview.median_price ||
    !marketOverview.volume
  ) {
    return false
  }

  if (Number(marketOverview.volume.replace(/,/g, '')) < minVolume) {
    return false
  }

  return calculateROI(stringToNumber(marketOverview.median_price), sellMinPrice) >= 40
}
