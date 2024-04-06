export type GoodsInfo = {
  data: {
    id: number
    sell_min_price: string
    super_short_name: string
  }
}

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
}

export type BriefAsset = {
  data: {
    total_amount: number
  }
}

export type GoodsBuyResponse = {
  error: string
  code: 'OK' | 'CSRF Verification Error'
  data: unknown
}
