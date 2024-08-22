export type GoodsSellOrderItem = {
  id: string
  appid: number
  goods_id: number
  price: string
  user_id: string
  asset_info: {
    paintwear: string
  }
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

export type TopBookmarkedItem = {
  goods_id: number
  price: string
}

export type TopBookmarked = {
  data: {
    goods_infos: {
      [key: number]: {
        goods_id: number
        market_hash_name: string
        steam_price: string
      }
    }
    items: TopBookmarkedItem[]
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
    icon_url: string
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
  updated_at: number
  type: number
}

export type MarketGoodsBillOrder = {
  data: {
    items: MarketGoodsBillOrderItem[]
  }
  code: string
}

export type GoodsInfo = {
  data: {
    goods_info: {
      goods_ref_price: string
    }
  }
  code: string
}

export type PriceHistoryItem = [number, number]

export type MarketPriceHistory = {
  data: {
    price_history: PriceHistoryItem[]
  }
}

export type MarketPriceOverview = {
  lowest_price: string
  median_price: string
  success: boolean
  volume: string
}
