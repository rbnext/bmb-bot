export type GoodsSellOrderItem = {
  id: string
  appid: number
  goods_id: number
  price: string
  user_id: string
}

export type GoodsSellOrder = {
  data: {
    items: GoodsSellOrderItem[]
    user_infos: {
      [key: string]: {
        nickname: string
      }
    }
  }
  code: string
}

export type BriefAsset = {
  data: {
    total_amount: number
    cash_amount: number
  }
}

export type GoodsBuyResponse = {
  error: string
  code: 'OK' | 'CSRF Verification Error'
  data: unknown
}

export type MarketGoodsItem = {
  id: number
  market_hash_name: string
  sell_min_price: string
  sell_reference_price: string
  goods_info: {
    steam_price: string
  }
  sell_num: number
}

export type MarketGoods = {
  data: {
    items: MarketGoodsItem[]
  }
  code: string
}

export type MarketGoodsBillOrderItem = {
  price: string
}

export type MarketGoodsBillOrder = {
  data: {
    items: MarketGoodsBillOrderItem[]
  }
  code: string
}

export type MarketPriceOverview = {
  lowest_price: string
  median_price: string
  success: boolean
  volume: string
}
