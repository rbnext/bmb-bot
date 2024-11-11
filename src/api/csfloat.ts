import axios from 'axios'

import { CSFloatListing } from '../types'
import { format, formatDistance } from 'date-fns'

const http = axios.create({
  baseURL: 'https://csfloat.com/api',
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
})

http.interceptors.response.use(
  (response) => {
    const now = format(new Date(), 'HH:mm:ss')

    const ratelimitReset = Number(response.headers['x-ratelimit-reset'])
    const rateLimitRemaining = Number(response.headers['x-ratelimit-remaining'])
    const ratelimitLimit = Number(response.headers['x-ratelimit-limit'])

    const distance = formatDistance(new Date(ratelimitReset * 1000), new Date(), {
      addSuffix: true,
      includeSeconds: true,
    })

    if (rateLimitRemaining === 5) {
      throw new Error('Rate limit remaning error!')
    }

    if (rateLimitRemaining % 50 === 0) {
      console.log(`${now} ${rateLimitRemaining}/${ratelimitLimit}. Reset ${distance}`)
    }

    return response
  },
  (error) => {
    return Promise.reject(error)
  }
)

export const getCSFloatListings = async ({
  limit = 40,
  sort_by = 'most_recent',
  type = 'buy_now',
  min_price = 1000,
  max_price = 3000,
  min_ref_qty = 20,
}: {
  limit?: number
  sort_by?: string
  type?: string
  min_price?: number
  max_price?: number
  min_ref_qty?: number
}): Promise<CSFloatListing> => {
  const { data } = await http.get('/v1/listings', {
    params: { limit, sort_by, type, min_price, max_price, min_ref_qty },
    headers: {
      cookie:
        '_gcl_au=1.1.1063302119.1727505941; __stripe_mid=f583cec4-8c53-4932-a881-c00a504cbe6a9055fb; _gid=GA1.2.266942457.1731168347; session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGVhbV9pZCI6Ijc2NTYxMTk5NjI1NTU0OTc1Iiwibm9uY2UiOjAsImltcGVyc29uYXRlZCI6ZmFsc2UsImlzcyI6ImNzdGVjaCIsImV4cCI6MTczMTY2NzE4Nn0.bfEjKppNJqgzRb3H11s6LOAhtO5yEfU05XP35MnZG2U; __stripe_sid=9c5e64d8-b8ca-477b-9c43-6031ec0479990191fd; _ga=GA1.1.1040761257.1727505941; _ga_3V4JQEGNYC=GS1.1.1731315657.14.1.1731317251.8.0.0',
    },
  })

  return data
}
