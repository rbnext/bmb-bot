import axios from 'axios'
import { CurrencyRates } from '../types'
import { setupCache } from 'axios-cache-interceptor'

const instance = axios.create({
  baseURL: 'https://api.currencyfreaks.com',
})

const http = setupCache(instance)

export const getLatestCurrencyRates = async (): Promise<CurrencyRates> => {
  const { data } = await http.get(`/v2.0/rates/latest`, {
    params: {
      apikey: 'f57aa34ae21e4921905f6a2c8f2a3549',
    },
    cache: {
      ttl: 1000 * 60 * 60 * 24, // 24 hours
    },
  })

  return data
}
