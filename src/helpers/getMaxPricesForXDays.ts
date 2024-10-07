import { getPriceHistory } from '../api/steam'
import { parse, format, differenceInDays, isToday } from 'date-fns'
import { sendMessage } from '../api/telegram'

export const getMaxPricesForXDays = async (
  market_hash_name: string,
  operation: 'max' | 'min' = 'max',
  days: number = 5
): Promise<number[]> => {
  try {
    const response = await getPriceHistory({ market_hash_name })

    const history = response.prices.reduce<Record<string, number[]>>((acc, [date, price]) => {
      const formattedDate = format(parse(date.replace(': +0', ''), 'MMM dd yyyy HH', new Date()), 'MM-dd-yyyy')

      if (isToday(formattedDate) || differenceInDays(new Date(), new Date(formattedDate)) >= days + 1) {
        return acc
      }

      acc[formattedDate] = [...(acc[formattedDate] || []), price]

      return acc
    }, {})

    console.log(`${format(new Date(), 'HH:mm:ss')}: ${market_hash_name} ${JSON.stringify(history)}`)

    if (Object.keys(history).length !== days) {
      return []
    }

    return Object.keys(history).map((date) => Math[operation](...history[date]))
  } catch (error) {
    await sendMessage('Error fetching price history from steam.')

    return []
  }
}
