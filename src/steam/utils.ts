import { getGoodsInfo, getMarketGoods } from '../api/buff'
import { sendMessage } from '../api/telegram'

const REFERENCE_PRICES: Record<string, number> = {}

export const getItemReferencePrice = async (market_hash_name: string): Promise<number> => {
  if (typeof REFERENCE_PRICES[market_hash_name] === 'number') {
    console.log('Reference price is taken from cache.', REFERENCE_PRICES[market_hash_name])

    return REFERENCE_PRICES[market_hash_name]
  }

  try {
    const goods = await getMarketGoods({ search: market_hash_name })
    const goods_id = goods.data.items.find((el) => el.market_hash_name === market_hash_name)?.id

    if (goods_id) {
      const goodsInfo = await getGoodsInfo({ goods_id })
      const reference_price = Number(goodsInfo.data.goods_info.goods_ref_price)

      REFERENCE_PRICES[market_hash_name] = reference_price

      return reference_price
    }

    return 0
  } catch (error) {
    await sendMessage('BUFF.MARKET: ' + error.message)

    return 0
  }
}

export const calculateTotalCost = (stickers: string[], details: Record<string, number>): number => {
  const groupByStickerName = stickers.reduce<Record<string, number>>((acc, name) => {
    return { ...acc, [name]: (acc[name] || 0) + 1 }
  }, {})

  const totalCost = Object.keys(groupByStickerName).reduce((acc, name) => {
    const price = details[name] || 0
    const stickerCount = groupByStickerName[name]
    const discountRate = stickerCount >= 4 ? 0.4 : 0.15

    return acc + price * discountRate * stickerCount
  }, 0)

  return totalCost
}
