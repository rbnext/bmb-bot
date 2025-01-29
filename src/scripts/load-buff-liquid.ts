import 'dotenv/config'
import { getMarketGoods, getMarketGoodsBillOrder } from '../api/buff'
import path from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { differenceInDays } from 'date-fns'
import { sleep } from '../utils'

const loadBuffLiquid = async () => {
  const marketGoods = await getMarketGoods({
    min_price: 5,
    max_price: 40,
    category_group: 'rifle,pistol,smg,shotgun,machinegun',
    page_num: 1,
    quality: 'strange',
  })

  for (const item of marketGoods.data.items) {
    const pathname = path.join(__dirname, '../../buff.json')
    const sales: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

    if (sales[item.market_hash_name]) continue

    const history = await getMarketGoodsBillOrder({ goods_id: item.id })

    const salesLastWeek = history.data.items.filter(({ updated_at, type }) => {
      return differenceInDays(new Date(), new Date(updated_at * 1000)) <= 7 && type !== 2
    })

    console.log(item.market_hash_name, salesLastWeek.length)

    if (salesLastWeek.length >= 4) {
      const pathname = path.join(__dirname, '../../buff.json')
      const sales: Record<string, number> = JSON.parse(readFileSync(pathname, 'utf8'))

      writeFileSync(pathname, JSON.stringify({ ...sales, [item.market_hash_name]: item.id }, null, 4), 'utf8')
    }

    await sleep(3_000)
  }
}

loadBuffLiquid()
