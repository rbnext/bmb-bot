import axios from 'axios'
import { TelegramResponse } from '../types'

const http = axios.create({
  baseURL: 'https://api.telegram.org',
})

export const sendMessage = async ({
  text,
  reply_to_message_id,
  chat_id,
  photo,
}: {
  text: string
  reply_to_message_id?: number
  chat_id?: string
  photo?: string
}): Promise<TelegramResponse> => {
  const { data } = await http.get(`/bot${process.env.BOT_TOKEN}/sendMessage`, {
    params: {
      parse_mode: 'HTML',
      chat_id: chat_id ?? process.env.TELEGRAM_CHAT_ID,
      link_preview_options: JSON.stringify({ is_disabled: true }),
      reply_to_message_id,
      photo,
      text,
    },
  })

  return data
}
