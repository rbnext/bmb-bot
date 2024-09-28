import { differenceInDays } from 'date-fns'
import {
  getBriefAsset,
  getCreatePreviewBargain,
  getGoodsInfo,
  getGoodsSellOrder,
  getMarketGoodsBillOrder,
  getUserStorePopup,
  postCreateBargain,
} from '../api/buff'
import { MarketGoodsItem, MessageType, Source } from '../types'
import { generateMessage, median, sleep } from '../utils'
import { BARGAIN_PROFIT_THRESHOLD, GOODS_SALES_THRESHOLD, REFERENCE_DIFF_THRESHOLD } from '../config'
import { sendMessage } from '../api/telegram'

const BARGAIN_OFFER_IDS_CACHE: string[] = []

export const executeBuffToBuffBargain = async (item: MarketGoodsItem) => {
  const goods_id = item.id
  const name = item.market_hash_name
  const current_price = Number(item.sell_min_price)

  const history = await getMarketGoodsBillOrder({ goods_id })

  const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
    return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
  })

  if (salesLastWeek.length > GOODS_SALES_THRESHOLD) {
    const buffLink = `https://buff.market/market/goods/${goods_id}`
    const errorPrefix = `Unable to initiate a bargain for <a href="${buffLink}">${name}</a>`

    const {
      data: {
        items: [lowestPricedItem],
      },
    } = await getGoodsSellOrder({ goods_id, exclude_current_user: 1, max_price: item.sell_min_price })

    const sales = salesLastWeek.map(({ price }) => Number(price))
    const median_price = median(sales.filter((price) => current_price * 2 > price))
    const desired_price = Number((median_price - (median_price * BARGAIN_PROFIT_THRESHOLD) / 100).toFixed(2))
    const lowest_bargain_price = Number(lowestPricedItem.lowest_bargain_price)

    if (!lowestPricedItem) {
      await sendMessage(`${errorPrefix}. Someone has already purchased this item for ${current_price}.`)

      return
    }

    if (!lowestPricedItem.allow_bargain) {
      await sendMessage(`${errorPrefix}. User ${lowestPricedItem.user_id} has disabled accepting bargains.`)

      return
    }

    if (lowest_bargain_price > desired_price) {
      await sendMessage(
        `${errorPrefix}. Desired price ${desired_price} is lower than the required bargain price ${lowest_bargain_price}`
      )

      return
    }

    if (BARGAIN_OFFER_IDS_CACHE.includes(lowestPricedItem.id)) {
      await sendMessage(`${errorPrefix}. This item has already been offered a bargain.`)

      return
    }

    if (lowestPricedItem.asset_info.paintwear) {
      const float = Number(lowestPricedItem.asset_info.paintwear)

      if (
        (float > 0.12 && float < 0.15) ||
        (float > 0.3 && float < 0.38) ||
        (float > 0.41 && float < 0.45) ||
        float > 0.5
      ) {
        await sendMessage(`${errorPrefix}. Float value not allowed: ${float}.`)

        return
      }
    }

    const goodsInfo = await getGoodsInfo({ goods_id })

    const goods_ref_price = Number(goodsInfo.data.goods_info.goods_ref_price)
    const referencePriceDiff = (goods_ref_price / desired_price - 1) * 100

    if (referencePriceDiff < REFERENCE_DIFF_THRESHOLD) {
      await sendMessage(
        `${errorPrefix}. The difference from the reference price is ${referencePriceDiff.toFixed(2)}%. Desired price: ${desired_price}. Current price: ${current_price}. Reference price: ${goods_ref_price}`
      )

      return
    }

    const user = await getUserStorePopup({ user_id: lowestPricedItem.user_id })

    if (user.data.bookmark_count < 2) {
      await sendMessage(`${errorPrefix}. User ${user.data.user.nickname} has ${user.data.bookmark_count} subscribers.`)

      return
    }

    await sleep(2_000) // We need to implement this delay to prevent the backend from blocking our requests.

    const assets = await getBriefAsset()

    if (Number(assets.data.cash_amount) < desired_price) {
      await sendMessage(
        `${errorPrefix}. Not enough money to bargain the item for ${desired_price}. Desired price: ${desired_price}. Current balance: ${assets.data.cash_amount}.`
      )

      return
    }

    const previewBargain = await getCreatePreviewBargain({ sell_order_id: lowestPricedItem.id, price: desired_price })

    if (previewBargain.code !== 'OK') {
      await sendMessage(`${errorPrefix}. Reason(preview): ${previewBargain.code}`)

      return
    }

    if (previewBargain?.data?.pay_confirm?.id === 'bargain_higher_price') {
      await sendMessage(
        `${errorPrefix}. Your bargain offer is lower than the other pending offers for this item. Desired price: ${desired_price}. Current price: ${current_price}.`
      )

      return
    }

    const createBargain = await postCreateBargain({ sell_order_id: lowestPricedItem.id, price: desired_price })

    if (createBargain.code !== 'OK') {
      await sendMessage(`${errorPrefix}. Reason(create): ${createBargain.code}`)

      return
    }

    const payload = {
      id: goods_id,
      price: desired_price,
      name: item.market_hash_name,
      type: MessageType.Bargain,
      source: Source.BUFF_BARGAIN,
      medianPrice: median_price,
      estimatedProfit: BARGAIN_PROFIT_THRESHOLD,
    }

    await sendMessage(generateMessage(payload))

    BARGAIN_OFFER_IDS_CACHE.push(lowestPricedItem.id)
  }

  await sleep(5_000)
}
