import { Context } from 'telegraf'
import { JOBS } from '.'
import { getBriefAsset, getGoodsSellOrder, postGoodsBuy } from './api/buff'
import { MARKET_CACHE } from './buff2steam'
import { MarketGoodsItem } from './types'
import { sleep } from './utils'

export const purchaseGoodsById = async (
  { id, market_hash_name, sell_min_price, goods_info: { steam_price, icon_url } }: MarketGoodsItem,
  ctx: Context
) => {
  const {
    data: { cash_amount },
  } = await getBriefAsset()

  let totalAmount = Number(cash_amount) ?? 0

  const sellOrders = await getGoodsSellOrder({ goods_id: id, max_price: sell_min_price, exclude_current_user: 1 })

  for (const filteredGood of sellOrders.data.items) {
    if (Number(filteredGood.price) > totalAmount) {
      JOBS[ctx.message!.chat.id].cancel()

      await ctx.telegram.sendMessage(ctx.message!.chat.id, 'Oops! Not enough funds. Please add more to your account.')

      break
    }

    await sleep(1_000)
    await postGoodsBuy({ sell_order_id: filteredGood.id, price: Number(filteredGood.price) })

    await ctx.telegram.sendPhoto(ctx.message!.chat.id, icon_url, {
      caption:
        `${market_hash_name}\n\n` +
        `Buff Market price: ${sell_min_price}$\n` +
        `Steam median price: ${MARKET_CACHE[market_hash_name].median_price}\n` +
        `Steam volume: ${MARKET_CACHE[market_hash_name].volume}\n` +
        `Paintwear: ${filteredGood.asset_info?.paintwear ?? 'undefined'}`,
    })

    totalAmount -= Number(filteredGood.price)
  }

  await ctx.telegram.sendMessage(ctx.message!.chat.id, `Balance after purchase ${totalAmount.toFixed(2)}$`)
}
