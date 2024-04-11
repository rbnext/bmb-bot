import { ComparisonItems } from '../types'

export const getComparisonItems = async (): Promise<ComparisonItems> => {
  var headers = new Headers()

  headers.append(
    'Cookie',
    'cf_clearance=VAiyrKAycaoEmJPx_4lWMo6pxAJvg5So56rypdk0NPk-1712771289-1.0.1.1-qp14TE0It3.8OQRr8dNuJKBbHlvCq2.WE2Do0p5rL7WOnbBxUOsxm05yi8QluPUZP8I7HZDXv1n5xRdw_C4ZDQ; _ga=GA1.1.694366131.1712771289; token-b=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGVhbTY0SWQiOiI3NjU2MTE5OTYwNTMzOTAwOSIsImlwIjoiODMuMjQuMjUwLjEyOSIsInNlc3Npb25JZCI6MjI4NTA1OSwiaWF0IjoxNzEyNzcxNDE5LCJleHAiOjE3MTUzNjM0MTl9.-PULnDeZ0hBX50FXPjC79w_jCrtdVbQGlIGm7bP4Aeo; user-b=76561199605339009; _ga_5YMSVJKHTZ=GS1.1.1712771289.1.1.1712771488.60.0.0; cfz_google-analytics_v4=%7B%22lTnF_engagementDuration%22%3A%7B%22v%22%3A%220%22%2C%22e%22%3A1744307488563%7D%2C%22lTnF_engagementStart%22%3A%7B%22v%22%3A%221712771488563%22%2C%22e%22%3A1744307488563%7D%2C%22lTnF_counter%22%3A%7B%22v%22%3A%2223%22%2C%22e%22%3A1744307488563%7D%2C%22lTnF_ga4sid%22%3A%7B%22v%22%3A%221049378711%22%2C%22e%22%3A1712773288563%7D%2C%22lTnF_session_counter%22%3A%7B%22v%22%3A%221%22%2C%22e%22%3A1744307488563%7D%2C%22lTnF_ga4%22%3A%7B%22v%22%3A%226ec60b39-1fa0-4fd7-ac16-7a344f5b0d7c%22%2C%22e%22%3A1744307488563%7D%2C%22lTnF__z_ga_audiences%22%3A%7B%22v%22%3A%226ec60b39-1fa0-4fd7-ac16-7a344f5b0d7c%22%2C%22e%22%3A1744307289064%7D%2C%22lTnF_let%22%3A%7B%22v%22%3A%221712771488563%22%2C%22e%22%3A1744307488563%7D%7D'
  )

  const response = await fetch(
    'https://api.pricempire.com/v3/comparison/items?priceFrom=1&priceTo=100000&page=1&compareFrom=buffmarket&compareTo=steam&compareToFee=13&sort=roi:DESC&steamVolume=250&priceDays=10&qtyFrom=0&qtyTo=100&minRoi=35&maxRoi=1000&liquidity=0&myItems=false&refresh=0&appId=730',
    {
      method: 'GET',
      redirect: 'follow',
      headers,
    }
  )

  const data = await response.text()

  return JSON.parse(data)
}
