//FL_CURRENT_USER_ID
import 'dotenv/config'

import { sleep } from '../utils'
import { FL_CURRENT_USER_ID } from '../config'
import { sendMessage } from '../api/telegram'
import { getCSFloatListings, getMySellingList } from '../api/csfloat'

const floatSelling = async () => {
  const messages: string[] = []
  const sellingSet = new Set<string>()

  const response = await getMySellingList({})

  for (const data of response.data) {
    if (data.item.float_value) {
      sellingSet.add(data.item.market_hash_name)
    }
  }

  console.log('Items:', sellingSet.size)

  for (const market_hash_name of sellingSet.values()) {
    const response = await getCSFloatListings({ sort_by: 'best_deal', market_hash_name })
    const position = response.data.findIndex((item) => item.seller.steam_id === FL_CURRENT_USER_ID)

    console.log(market_hash_name, position)

    messages.push(
      `<a href="https://csfloat.com/search?market_hash_name=${market_hash_name}">${market_hash_name}</a> (${position === -1 ? 'N/A' : position + 1})`
    )

    await sleep(10_000)
  }

  const size = 10
  const tgMessages: string[][] = []

  for (let i = 0; i < messages.length; i += size) {
    tgMessages.push(messages.slice(i, i + size))
  }

  for (const msg of tgMessages) {
    if (msg.length !== 0) {
      await sendMessage('<b>FLOAT SELLING REPORT</b>\n\n' + msg.map((msg, index) => `${index + 1}. ${msg}`).join('\n'))
    }

    await sleep(5_000)
  }

  await sleep(60_000 * 60)

  floatSelling()
}

floatSelling()
