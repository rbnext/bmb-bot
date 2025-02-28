import 'dotenv/config'
import { GoogleSpreadsheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'
import { BuffBlacklistItem } from '../types'

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
  key: process.env.GOOGLE_PRIVATE_KEY!,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, serviceAccountAuth)

export const getBuffBlacklist = async (): Promise<BuffBlacklistItem[]> => {
  await doc.loadInfo()

  const sheet = doc.sheetsById['550718046']

  const rows = await sheet.getRows()
  const response = rows.map((row) => ({ goods_id: Number(row.get('goods_id')), comment: row.get('comment') }))

  return response
}
