import { getBriefAsset, getGoodsSellOrder, postGoodsBuy } from './api/buff'
import { sleep } from './utils'

export const purchaseGoodsById = async ({
  goodsId,
  sellMinPrice,
  marketHashName,
  logger,
}: {
  goodsId: number
  sellMinPrice: string
  marketHashName: string
  logger: (data: { message: string; error?: boolean }) => void
}) => {
  const {
    data: { total_amount },
  } = await getBriefAsset()

  let totalAmount = Number(total_amount) ?? 0

  const sellOrders = await getGoodsSellOrder({ goods_id: goodsId, max_price: sellMinPrice, exclude_current_user: 1 })

  for (const filteredGood of sellOrders.data.items) {
    if (Number(filteredGood.price) > totalAmount) {
      await logger({ message: `No cash to buy "${marketHashName}" for ${filteredGood.price}$`, error: true })

      break
    }

    await sleep(1_000)
    await postGoodsBuy({ sell_order_id: filteredGood.id, price: Number(filteredGood.price) })
    await logger({ message: `Purchase "${marketHashName}". Price: ${Number(sellMinPrice).toFixed(2)}$` })

    totalAmount -= Number(filteredGood.price)
  }

  await logger({ message: `Balance: ${totalAmount.toFixed(2)}$` })
}
