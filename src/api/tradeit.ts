import axios from 'axios'
import { FloatItemFinder } from '../types'
import { setupCache } from 'axios-cache-interceptor'

const instance = axios.create({
  baseURL: 'https://tradeit.gg/api',
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
})

const http = setupCache(instance)

export const getFloatItemFinder = async ({ inspectLink }: { inspectLink: string }): Promise<FloatItemFinder> => {
  const { data } = await http.get(`/steam/v1/steams/float-item-finder`, {
    params: {
      inspectLink: decodeURI(inspectLink),
    },
    cache: {
      ttl: 1000 * 60 * 60 * 24, // 24 hours
    },
  })

  return data
}
