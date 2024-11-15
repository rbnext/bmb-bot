import axios from 'axios'
import { SIHInspectItemInfo } from '../types'
import { setupCache } from 'axios-cache-interceptor'

const http = axios.create({
  baseURL: 'https://floats.steaminventoryhelper.com',
  headers: {
    'User-Agent': 'Node/12.14.1',
  },
})

const headers = {
  Host: 'floats.steaminventoryhelper.com',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
}

export const getSIHInspectItemInfo = async ({ url }: { url: string }): Promise<SIHInspectItemInfo> => {
  const { data } = await http.get(`/`, {
    params: {
      url: decodeURI(url),
    },
    headers,
  })

  return data
}
