import axios from 'axios'

const http = axios.create({
  baseURL: 'https://api.telegram.org',
})

export const sendMessage = async (message: string): Promise<unknown> => {
  const { data } = await http.get(`/bot${process.env.BOT_TOKEN}/sendMessage`, {
    params: {
      parse_mode: 'HTML',
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: message,
    },
  })
  return data
}
