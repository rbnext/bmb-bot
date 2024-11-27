import axios from 'axios'
import { parse } from 'set-cookie-parser'

import { GoodsSellOrder, MarketGoods } from '../types'

export const defaultCookies: Record<string, string> = {
  'Locale-Supported': 'en',
  'Device-Id': 'gF1kHxEd9QqrHS3qHSUr',
  session: '1-bVU604W97ReLTS6icEEN7ys6SnOO7UW-n8krmzSkCzdw2026410633',
  remember_me: 'U1074138577|lGtDI0BXxlXIEyoDqQSUYVei2wa03Dg2',
  csrf_token: 'ImExOTdkNzNiMTg5YjI1YzI3ZWE1ZDI3MDQ4NGM2MGEwM2NmZTg3N2Yi.ZzkWTg.sQ81Tytr-U7ujpFMsENU0Wu4ioM',
}

const http = axios.create({
  baseURL: 'https://buff.163.com/api',
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
})

export const getCookies = (cookies: Record<string, string>) => {
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

export const getBuff163MarketGoods = async ({
  game = 'csgo',
  page_num = 1,
  page_size = 50,
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
      ...rest,
    },
  })

  return data
}

export const getBuff163GoodsSellOrder = async ({
  game = 'csgo',
  page_num = 1,
  sort_by = 'default',
  ...rest
}: {
  game?: string
  page_num?: number
  goods_id: number
  min_paintseed?: number
  max_paintseed?: number
  sort_by?: string
}): Promise<GoodsSellOrder> => {
  const { data } = await http.get('/market/goods/sell_order', {
    params: { game, page_num, sort_by, ...rest },
  })

  return data
}
