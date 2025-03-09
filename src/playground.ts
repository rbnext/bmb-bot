import 'dotenv/config'

import { getBuyOrderHistory } from './api/buff'
import { addTradeRecord } from './api/spreadsheet'
import { sleep } from './utils'
import { GoogleSheetTradeRecord, TradeRecordSource } from './types'

const init = async () => {
  const pages = Array.from({ length: 5 }, (_, i) => i + 1)

  const tradeRecords: GoogleSheetTradeRecord[] = []

  for (const page_num of pages) {
    const goods = await getBuyOrderHistory({
      page_num,
    })

    const records = goods.data.items
      .filter((item) => item.state === 'SUCCESS')
      .map((item) => ({
        id: item.id,
        market_hash_name: goods.data.goods_infos[item.goods_id].market_hash_name,
        float: item.asset_info.paintwear,
        buy_price: Number(item.price),
        source: TradeRecordSource.BuffMarket,
        created_at: new Date(item.created_at * 1000).toDateString(),
      }))

    tradeRecords.push(...records)
    await sleep(5_000)
  }

  await addTradeRecord(tradeRecords.reverse())
}

init()
