import axios from 'axios'
import { TelegramResponse } from '../types'

const http = axios.create({
  baseURL: 'https://api.telegram.org',
})

export const sendMessage = async (text: string, reply_to_message_id?: number): Promise<TelegramResponse> => {
  const { data } = await http.get(`/bot${process.env.BOT_TOKEN}/sendMessage`, {
    params: {
      parse_mode: 'HTML',
      chat_id: process.env.TELEGRAM_CHAT_ID,
      link_preview_options: JSON.stringify({ is_disabled: true }),
      reply_to_message_id,
      text,
    },
  })

  return data
}
