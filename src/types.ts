export type GoodsSellOrderItem = {
  id: string
  appid: number
  goods_id: number
  price: string
  user_id: string
  allow_bargain: boolean
  lowest_bargain_price: string
  created_at: number
  updated_at: number

  asset_info: {
    classid: string
    assetid: string
    instanceid: string
    contextid: number
    paintwear: string
    info: {
      stickers: unknown[]
    }
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

export type Katowice14Item = {
  id: string
  goods_id: number
  created_at: number
  updated_at: number
  price: string
  sticker_premium: number
  asset_info: {
    paintwear: string
    classid: string
    assetid: string
    instanceid: string
    contextid: number
    info: {
      stickers: Sticker[]
    }
  }
}

export type Katowice14 = {
  data: {
    goods_infos: {
      [key: number]: {
        goods_id: number
        market_hash_name: string
        steam_price: string
      }
    }
    items: Katowice14Item[]
  }
}

export type Sticker = {
  category: 'sticker'
  goods_id: number
  img_url: string
  name: string
  sell_reference_price: string
  sticker_name: string
  wear: number
}

export type MarketItemDetail = {
  data: {
    asset_info: {
      stickers: Sticker[]
    }
  }
}

export type GoodsBuyResponse = {
  error: string
  code: 'OK' | 'CSRF Verification Error'
  data: unknown
}

export type CreateBargainResponse = {
  code: 'OK' | 'CSRF Verification Error'
  data: unknown
}

export type PayMethodItem = {
  balance: string
  enough: boolean
  error: string
  value: number
}

export type CreatePreviewBargainResponse = {
  code: 'OK' | 'CSRF Verification Error'
  data?: {
    pay_confirm?: {
      id: 'bargain_higher_price'
    }
    pay_methods: PayMethodItem[]
  }
}

export type CancelBargainResponse = {
  code: 'OK' | 'CSRF Verification Error'
  data: unknown
}

export type PostResponse = {
  code: 'OK' | 'CSRF Verification Error'
  data: unknown
}

export type MarketBatchFee = {
  data: {
    total_fee: string
  }
}

export type UserStorePopup = {
  data: {
    bookmark_count: number
    desc: string
    user: {
      nickname: string
    }
  }
  code: 'OK'
}

export type SentBargainItem = {
  id: string
  state: number
  created_at: number
  can_cancel_time: number
  can_cancel_timeout: number
  sell_order_id: string
}

export type SentBargain = {
  data: {
    items: SentBargainItem[]
  }
}

export type BuyOrderHistoryItem = {
  asset_info: {
    assetid: string
    classid: string
  }
  price: string
}

export type BuyOrderHistory = {
  data: {
    items: BuyOrderHistoryItem[]
  }
}

export type OnSaleItem = {
  id: string
  price: string
  income: string
  is_cheapest: boolean
  goods_id: number
  asset_info: {
    assetid: string
    classid: string
    instanceid: string
  }
}

export type ItemsOnSale = {
  data: {
    items: OnSaleItem[]
    goods_infos: {
      [key: number]: {
        market_hash_name: string
      }
    }
  }
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
  has_bargain: boolean
  seller_id: string
  original_price: string
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

export type SteamMarketPriceOverview = {
  lowest_price: string
  median_price: string
  success: boolean
  volume: string
}

export type SteamMarketPriceHistoryItem = [string, number, string]

export type SteamMarketPriceHistory = {
  success: boolean
  prices: SteamMarketPriceHistoryItem[]
}

export enum MessageType {
  Purchased = 'PURCHASED',
  Review = 'REVIEW',
  Bargain = 'BARGAIN',
  ManualBargain = 'MANUAL_BARGAIN',
}

export enum Source {
  BUFF_BUFF = 'BUFF_BUFF',
  BUFF_DEFAULT = 'BUFF_DEFAULT',
  BUFF_STEAM = 'BUFF_STEAM',
  BUFF_BARGAIN = 'BUFF_BARGAIN',
  BUFF_KATOWICE = 'BUFF_KATOWICE',
}
