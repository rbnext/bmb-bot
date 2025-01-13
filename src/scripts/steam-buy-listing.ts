import 'dotenv/config'

import { stemMarketBuyListing } from '../api/steam'

const init = async () => {
  try {
    const response = await stemMarketBuyListing({
      idListing: '648054857965202095',
      market_hash_name: 'MP9 | Slide (Field-Tested)',
      converted_price: 1,
      converted_fee: 2,
    })

    console.log(response)
  } catch (error) {
    console.log(error)
    console.log(error.message)
  }
}

init()
