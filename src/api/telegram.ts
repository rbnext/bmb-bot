import axios from 'axios'

import { MarketPriceOverview } from '../types'

const http = axios.create({
  baseURL: 'https://api.telegram.org',
})

export const sendMessage = async (message: string): Promise<MarketPriceOverview> => {
  const { data } = await http.get<MarketPriceOverview>(`/bot${process.env.BOT_TOKEN}/sendMessage`, {
    params: { chat_id: process.env.TELEGRAM_CHAT_ID, text: message },
  })

  return data
}
