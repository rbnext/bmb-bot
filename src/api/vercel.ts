import axios from 'axios'

const http = axios.create({
  baseURL: 'https://market-rbnext.vercel.app/api',
})

export const createVercelPurchase = async ({
  price,
  sell_order_id,
}: {
  price: number
  sell_order_id: string
}): Promise<{ code: 'OK' }> => {
  const { data } = await http.post(
    '/buff/purchase',
    {
      price,
      sell_order_id,
    },
    {
      headers: {
        Cookie: `token=${process.env.ACCESS_TOKEN}`,
      },
    }
  )

  return data
}
