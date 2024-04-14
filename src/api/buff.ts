import axios from 'axios'
import { parse } from 'set-cookie-parser'
import { defaultCookies } from '../config'

import { BriefAsset, GoodsBuyResponse, GoodsInfo, GoodsSellOrder, MarketGoods } from '../types'

const http = axios.create({
  baseURL: 'https://api.buff.market/api',
})

const getCookies = (cookies: Record<string, string>) => {
  const cookieList = Object.keys(cookies).map((k) => `${k}=${cookies[k]};`)

  return cookieList.join(' ')
}

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

export const getGoodsInfo = async ({
  game = 'csgo',
  goods_id,
}: {
  game?: string
  goods_id: number
}): Promise<GoodsInfo> => {
  const { data } = await http.get('/market/goods/info', {
    params: { game, goods_id },
  })

  return data
}

export const getMarketGoods = async ({
  game = 'csgo',
  search,
  page_num = 1,
  page_size = 50,
  category,
  itemset,
  min_price,
  max_price,
  category_group,
}: {
  game?: string
  search?: string
  page_num?: number
  page_size?: number
  category?: string
  itemset?: string
  min_price?: number
  max_price?: number
  category_group?: string
}): Promise<MarketGoods> => {
  const { data } = await http.get('/market/goods', {
    params: { game, search, page_num, page_size, category, itemset, min_price, max_price, category_group },
    headers: {
      Cookie: getCookies(defaultCookies),
    },
  })

  return data
}

export const getGoodsSellOrder = async ({
  game = 'csgo',
  page_num = 1,
  goods_id,
  sort_by = 'default',
}: {
  game?: string
  page_num?: number
  goods_id: number
  sort_by?: string
}): Promise<GoodsSellOrder> => {
  const { data } = await http.get('/market/goods/sell_order', {
    params: { game, page_num, goods_id, sort_by },
    headers: {
      Cookie: getCookies(defaultCookies),
    },
  })

  return data
}

export const getBriefAsset = async (): Promise<BriefAsset> => {
  const { data } = await http.get('/asset/get_brief_asset', {
    headers: {
      Cookie: getCookies(defaultCookies),
    },
  })

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
  const { data } = await http.post(
    '/market/goods/buy',
    { game, pay_method, ...rest },
    {
      headers: {
        Cookie: getCookies(defaultCookies),
        'X-Csrftoken': defaultCookies['csrf_token'],
      },
    }
  )

  return data
}
