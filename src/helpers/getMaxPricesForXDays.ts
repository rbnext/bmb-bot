import { getPriceHistory } from '../api/steam'
import { parse, format, differenceInDays } from 'date-fns'
import { sendMessage } from '../api/telegram'

export const getMaxPricesForXDays = async (market_hash_name: string, days: number = 7): Promise<number[]> => {
  try {
    const response = await getPriceHistory({ market_hash_name })

    const history = response.prices.reduce<Record<string, number[]>>((acc, [date, price]) => {
      const formattedDate = format(parse(date.replace(': +0', ''), 'MMM dd yyyy HH', new Date()), 'MM-dd-yyyy')

      if (differenceInDays(new Date(), new Date(formattedDate)) >= days) {
        return acc
      }

      acc[formattedDate] = [...(acc[formattedDate] || []), price]

      return acc
    }, {})

    if (Object.keys(history).length !== days) {
      return []
    }

    return Object.keys(history).map((date) => Math.max(...history[date]))
  } catch (error) {
    await sendMessage('Error fetching price history from steam.')

    return []
  }
}
