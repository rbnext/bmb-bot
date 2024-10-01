import axios from 'axios'
import { parse } from 'set-cookie-parser'
import { setupCache } from 'axios-cache-interceptor'

import {
  BriefAsset,
  BuyOrderHistory,
  CancelBargainResponse,
  CreateBargainResponse,
  CreatePreviewBargainResponse,
  GoodsBuyResponse,
  GoodsInfo,
  GoodsSellOrder,
  ItemsOnSale,
  MarketBatchFee,
  MarketGoods,
  MarketGoodsBillOrder,
  MarketItemDetail,
  MarketPriceHistory,
  PostResponse,
  SentBargain,
  TopBookmarked,
  UserStorePopup,
} from '../types'

export const defaultCookies: Record<string, string> = {
  'Locale-Supported': 'en',
  'Device-Id': process.env.DEVICE_ID as string,
  session: process.env.SESSION_TOKEN as string,
  remember_me: process.env.REMEMBER_ME as string,
  csrf_token: process.env.CSRF_TOKEN as string,
  forterToken: process.env.FORTER_TOKEN as string,
}

const instance = axios.create({
  baseURL: 'https://api.buff.market/api',
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
})

const http = setupCache(instance)

const getCookies = (cookies: Record<string, string>) => {
  const cookieList = Object.keys(cookies).map((k) => `${k}=${cookies[k]};`)

  return cookieList.join(' ')
}

http.interceptors.request.use(
  (config) => {
    config.headers['Cookie'] = getCookies(defaultCookies)
    config.headers['X-Csrftoken'] = defaultCookies['csrf_token']

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

http.interceptors.response.use(
  (response) => {
    const setCookieHeader = response.headers['set-cookie']

    if (setCookieHeader) {
      const data = parse(setCookieHeader, { map: true })

      const session = 'session'
      const csrf_token = 'csrf_token'

      if (data[csrf_token] && defaultCookies[csrf_token]) {
        defaultCookies[csrf_token] = data[csrf_token].value
      }

      if (data[session] && defaultCookies[session]) {
        defaultCookies[session] = data[session].value
      }
    }

    return response
  },
  (error) => {
    return Promise.reject(error)
  }
)

export const getMarketGoods = async ({
  game = 'csgo',
  page_num = 1,
  page_size = 50,
  min_price = 3,
  max_price = 50,
  quality = 'normal',
  ...rest
}: {
  game?: string
  search?: string
  page_num?: number
  page_size?: number
  quality?: string
  category?: string
  itemset?: string
  min_price?: number
  max_price?: number
  series?: string
  category_group?: string
  exterior?: string
  sort_by?: string
}): Promise<MarketGoods> => {
  const { data } = await http.get('/market/goods', {
    params: {
      game,
      page_num,
      page_size,
      min_price,
      max_price,
      quality,
      ...rest,
    },
    cache: false,
  })

  return data
}

export const getGoodsSellOrder = async ({
  game = 'csgo',
  page_num = 1,
  sort_by = 'default',
  ...rest
}: {
  game?: string
  page_num?: number
  goods_id: number
  sort_by?: string
  max_price?: string
  exclude_current_user?: number
}): Promise<GoodsSellOrder> => {
  const { data } = await http.get('/market/goods/sell_order', {
    params: { game, page_num, sort_by, ...rest },
    cache: false,
  })

  return data
}

export const getTopBookmarked = async ({
  game = 'csgo',
  page_num = 1,
  page_size = 50,
  category_group,
  min_price = 5,
  max_price = 100,
}: {
  game?: string
  page_num?: number
  page_size?: number
  category_group?: string
  min_price?: number
  max_price?: number
}): Promise<TopBookmarked> => {
  const { data } = await http.get('/market/sell_order/top_bookmarked', {
    params: { game, page_num, page_size, category_group, max_price, min_price },
    cache: false,
  })

  return data
}

export const getBriefAsset = async (): Promise<BriefAsset> => {
  const { data } = await http.get('/asset/get_brief_asset', {
    cache: false,
  })

  return data
}

export const getMarketGoodsBillOrder = async ({
  game = 'csgo',
  goods_id,
}: {
  game?: string
  goods_id: number
}): Promise<MarketGoodsBillOrder> => {
  const { data } = await http.get('/market/goods/bill_order', {
    params: { game, goods_id },
    cache: {
      ttl: 1000 * 60 * 60 * 12, // 12 hours
    },
  })

  return data
}
export const getMarketItemDetail = async ({
  game = 'csgo',
  classid,
  instanceid,
  assetid,
  contextid,
  sell_order_id,
}: {
  game?: string
  classid: string
  instanceid: string
  assetid: string
  contextid: number
  sell_order_id: string
}): Promise<MarketItemDetail> => {
  const { data } = await http.get('/market/item_detail', {
    params: { game, classid, instanceid, assetid, contextid, sell_order_id },
    cache: false,
  })

  return data
}

export const getGoodsInfo = async ({
  game = 'csgo',
  goods_id,
}: {
  game?: string
  goods_id: number
}): Promise<GoodsInfo> => {
  const { data } = await http.get('/market/goods/info', {
    params: { game, goods_id },
    cache: {
      ttl: 1000 * 60 * 60, // 1 hour
    },
  })

  return data
}

export const getMarketPriceHistory = async ({
  game = 'csgo',
  goods_id,
  days = 7,
  buff_price_type = 1,
}: {
  game?: string
  goods_id: number
  buff_price_type?: number
  days?: number
}): Promise<MarketPriceHistory> => {
  const { data } = await http.get('market/goods/price_history/buff', {
    params: { game, goods_id, days, buff_price_type },
    cache: false,
  })

  return data
}

export const getItemsOnSale = async ({
  game = 'csgo',
  page_num = 1,
  page_size = 40,
}: {
  game?: string
  page_num?: number
  page_size?: number
}): Promise<ItemsOnSale> => {
  const { data } = await http.get('/market/sell_order/on_sale', {
    params: { game, page_num, page_size },
    cache: false,
  })

  return data
}

export const getSentBargain = async ({
  game = 'csgo',
  page_num = 1,
  page_size = 20,
}: {
  game?: string
  page_num?: number
  page_size?: number
}): Promise<SentBargain> => {
  const { data } = await http.get('/market/buy_order/sent_bargain', {
    params: { game, page_num, page_size },
    cache: false,
  })

  return data
}

export const getBuyOrderHistory = async ({
  game = 'csgo',
  page_num = 1,
  page_size = 20,
  search,
}: {
  game?: string
  page_num?: number
  page_size?: number
  search?: string
}): Promise<BuyOrderHistory> => {
  const { data } = await http.get('/market/buy_order/history', {
    params: { game, page_num, page_size, search },
  })

  return data
}

export const getCreatePreviewBargain = async ({
  game = 'csgo',
  sell_order_id,
  price,
}: {
  game?: string
  price: number
  sell_order_id: string
}): Promise<CreatePreviewBargainResponse> => {
  const { data } = await http.get('/market/buyer_bargain/create/preview', {
    params: { game, sell_order_id, price },
  })

  return data
}

export const getMarketBatchFee = async ({
  game = 'csgo',
  check_price = 0,
  is_change = 0,
  ...rest
}: {
  game?: string
  prices: string
  check_price?: number
  goods_ids: string
  is_change?: number
}): Promise<MarketBatchFee> => {
  const { data } = await http.get('/market/batch/fee', {
    params: { game, check_price, is_change, ...rest },
    cache: false,
  })

  return data
}

export const getUserStorePopup = async ({
  game = 'csgo',
  user_id,
}: {
  game?: string
  user_id: string
}): Promise<UserStorePopup> => {
  const { data } = await http.get('/market/user_store/popup', {
    params: { game, user_id },
    cache: {
      ttl: 1000 * 60 * 60 * 24, //24 hours
    },
  })

  return data
}

export const postSellOrderChange = async ({
  game = 'csgo',
  sell_orders,
}: {
  game?: string
  sell_orders: { desc: string; income: string; price: string; sell_order_id: string }[]
}): Promise<PostResponse> => {
  const { data } = await http.post('/market/sell_order/change', { game, sell_orders })

  return data
}

export const postSellOrderCancel = async ({
  game = 'csgo',
  sell_orders,
}: {
  game?: string
  sell_orders: string[]
}): Promise<PostResponse> => {
  const { data } = await http.post('/market/sell_order/cancel', { game, sell_orders })

  return data
}

export const postSellOrderManualPlus = async ({
  game = 'csgo',
  assets,
}: {
  game?: string
  assets: { assetid: string; game: string; income: number; price: string }[]
}): Promise<PostResponse> => {
  const { data } = await http.post('/market/sell_order/create/manual_plus', { game, assets })

  return data
}

export const postGoodsBuy = async ({
  game = 'csgo',
  pay_method = 12,
  ...rest
}: {
  game?: string
  pay_method?: number
  price: number
  sell_order_id: string
}): Promise<GoodsBuyResponse> => {
  const { data } = await http.post('/market/goods/buy', { game, pay_method, ...rest })

  return data
}

export const postCreateBargain = async ({
  game = 'csgo',
  pay_method = 12,
  ...rest
}: {
  game?: string
  pay_method?: number
  price: number
  sell_order_id: string
}): Promise<CreateBargainResponse> => {
  const { data } = await http.post('/market/buyer_bargain/create', { game, pay_method, ...rest })

  return data
}

export const postCancelBargain = async ({ bargain_id }: { bargain_id: string }): Promise<CancelBargainResponse> => {
  const { data } = await http.post('/market/buyer_bargain/cancel', { bargain_id })

  return data
}
