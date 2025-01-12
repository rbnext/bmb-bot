export const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}

export const isStickerCombo = (stickers: string[]) => {
  const groupByStickerName = stickers.reduce<Record<string, number>>((acc, name) => {
    return { ...acc, [name]: (acc[name] || 0) + 1 }
  }, {})

  return Object.keys(groupByStickerName).length === 1 && (stickers.length === 4 || stickers.length === 5)
}
