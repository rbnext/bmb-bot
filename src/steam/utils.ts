export const getInspectLink = (link: string, assetId: string, listingId: string): string => {
  return link.replace('%assetid%', assetId).replace('%listingid%', listingId)
}

export const calculateTotalCost = (stickers: string[], details: Record<string, number>): number => {
  const groupByStickerName = stickers.reduce<Record<string, number>>((acc, name) => {
    return { ...acc, [name]: (acc[name] || 0) + 1 }
  }, {})

  const totalCost = Object.keys(groupByStickerName).reduce((acc, name) => {
    const price = details[name] || 0
    const stickerCount = groupByStickerName[name]
    const discountRate = stickerCount >= 4 ? 0.4 : 0.15

    return acc + price * discountRate * stickerCount
  }, 0)

  return totalCost
}

export const isStickerCombo = (stickers: string[]) => {
  const groupByStickerName = stickers.reduce<Record<string, number>>((acc, name) => {
    return { ...acc, [name]: (acc[name] || 0) + 1 }
  }, {})

  return Object.keys(groupByStickerName).length === 1 && (stickers.length === 4 || stickers.length === 5)
}
