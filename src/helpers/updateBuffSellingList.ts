import { getItemsOnSale, postSellOrderCancel, postSellOrderManualPlus } from '../api/buff'
import { sendMessage } from '../api/telegram'
import { sleep } from '../utils'

export const updateBuffSellingList = async () => {
  try {
    const itemsOnSale = await getItemsOnSale({})

    const cheapestItems = itemsOnSale.data.items.filter((item) => item.is_cheapest)

    await postSellOrderCancel({ sell_orders: cheapestItems.map((item) => item.id) })

    await sleep(5_000)

    await postSellOrderManualPlus({
      assets: cheapestItems.map((item) => ({
        game: 'csgo',
        assetid: item.asset_info.assetid,
        income: +item.income,
        price: item.price,
      })),
    })
  } catch (error) {
    await sendMessage('Error fetching items on sale.')

    return
  }
}
