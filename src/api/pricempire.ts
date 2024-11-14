import axios from 'axios'
import { InspectItemInfo } from '../types'
import { setupCache } from 'axios-cache-interceptor'

const instance = axios.create({
  baseURL: 'https://inspect.pricempire.com',
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
})

const http = setupCache(instance)

export const getInspectItemInfo = async ({ url }: { url: string }): Promise<InspectItemInfo> => {
  const { data } = await http.get(`/`, {
    params: {
      url: decodeURI(url),
    },
    cache: {
      ttl: 1000 * 60 * 60 * 24, // 24 hours
    },
  })

  return data
}
