import { MapSteamMarketRenderResponse, SteamMarketRender } from '../types'

export const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}

export const isStickerCombo = (stickers: string[]) => {
  const groupByStickerName = stickers.reduce<Record<string, number>>((acc, name) => {
    return { ...acc, [name]: (acc[name] || 0) + 1 }
  }, {})

  return (
    (Object.keys(groupByStickerName).length === 1 || Object.keys(groupByStickerName).length === 2) &&
    (stickers.length === 4 || stickers.length === 5)
  )
}

export function extractSteamItemInfo(input: string): string[] {
  let match

  const stickers: string[] = []
  const titleRegex = /title="([^"]+)"/g

  while ((match = titleRegex.exec(input)) !== null) stickers.push(match[1])

  return stickers.map((name) => name.replace('Sticker: ', '').replace('Charm: ', ''))
}

export const mapSteamMarketRenderResponse = (data: SteamMarketRender) => {
  return Object.keys(data.listinginfo).reduce<MapSteamMarketRenderResponse[]>((acc, listingId, index) => {
    const listing = data.listinginfo[listingId]
    const price = Number(((listing.converted_price + listing.converted_fee) / 100).toFixed(2))

    const assetInfo = data.assets[730][listing.asset.contextid][listing.asset.id]
    const stickerInfo = assetInfo.descriptions.find((el) => el.value.includes('sticker_info'))?.value || ''
    const keychainInfo = assetInfo.descriptions.find((el) => el.value.includes('keychain_info'))?.value || ''
    const charmTemplate = assetInfo.descriptions.find((el) => el.value.includes('Charm Template'))?.value || ''

    const stickers = extractSteamItemInfo(stickerInfo)
    const keychains = extractSteamItemInfo(keychainInfo)
    const isStickerCombos = isStickerCombo(stickers)

    const link = listing.asset.market_actions[0].link
    const inspectUrl = getInspectLink(link, listing.asset.id, listingId)

    const pattern = charmTemplate ? Number(charmTemplate.match(/\d+/g)) : null

    return [
      ...acc,
      {
        price,
        stickers,
        keychains,
        inspectUrl,
        position: index + 1,
        isStickerCombos,
        listingId,
        pattern,
      },
    ]
  }, [])
}
