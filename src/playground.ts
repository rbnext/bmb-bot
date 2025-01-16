import 'dotenv/config'
// import { getCreatePreviewBargain, getSentBargain, postCancelBargain, postCreateBargain } from './api/buff'
// import { getDifferenceInMinutes, sleep } from './utils'
// import { getCSFloatListings } from './api/csfloat'
// import { getSkinPortListings } from './api/skinport'

import { getVercelMarketRender, getVercelSearchMarketRender } from './api/versel'

const skins = [
  // 'M4A1-S | Black Lotus (Factory New)',
  // 'M4A1-S | Black Lotus (Field-Tested)',
  // 'M4A1-S | Black Lotus (Minimal Wear)',
  // 'Glock-18 | Water Elemental (Minimal Wear)',
  // 'USP-S | Jawbreaker (Factory New)',
  // 'Desert Eagle | Printstream (Field-Tested)',
  // 'USP-S | Printstream (Field-Tested)',
  // 'Desert Eagle | Code Red (Field-Tested)',
  // 'Glock-18 | Gold Toof (Field-Tested)',
  // 'Desert Eagle | Conspiracy (Minimal Wear)',
  // 'AWP | Neo-Noir (Field-Tested)',
  // 'AWP | Chromatic Aberration (Field-Tested)',
  // 'SSG 08 | Acid Fade (Factory New)',
  // 'M4A1-S | Decimator (Minimal Wear)',
  // 'P250 | Asiimov (Field-Tested)',
  // "M4A1-S | Chantico's Fire (Well-Worn)",
  // 'M4A1-S | Cyrex (Field-Tested)',
  // 'USP-S | Neo-Noir (Minimal Wear)',

  // 'Zeus x27 | Olympus (Field-Tested)',
  // 'StatTrak™ Zeus x27 | Olympus (Field-Tested)',
  // 'USP-S | Blueprint (Field-Tested)',
  // 'M4A1-S | Hyper Beast (Field-Tested)',
  // 'AK-47 | Redline (Field-Tested)',
  // 'AK-47 | Frontside Misty (Field-Tested)',
  // 'Zeus x27 | Olympus (Factory New)',
  // 'USP-S | Jawbreaker (Minimal Wear)',
  // 'StatTrak™ AK-47 | Slate (Field-Tested)',

  // 'Michael Syfers | FBI Sniper', ???
  // 'AK-47 | Point Disarray (Field-Tested)',
  'Chem-Haz Specialist | SWAT',
  'AWP | Neo-Noir (Factory New)',
  'StatTrak™ AWP | Atheris (Field-Tested)',
  'Glock-18 | Gold Toof (Minimal Wear)',
  'AWP | Chrome Cannon (Well-Worn)',
  'AK-47 | Frontside Misty (Minimal Wear)',
  'MP9 | Starlight Protector (Field-Tested)',
  'StatTrak™ M4A1-S | Emphorosaur-S (Minimal Wear)',
  'Glock-18 | Vogue (Field-Tested)',
  'M4A1-S | Basilisk (Factory New)',
  'AWP | Sun in Leo (Minimal Wear)',
  'M4A1-S | Guardian (Factory New)',
  'AWP | Chromatic Aberration (Minimal Wear)',
  'Desert Eagle | Conspiracy (Factory New)',
  "M4A1-S | Chantico's Fire (Field-Tested)",
  'M4A4 | Temukau (Field-Tested)',
  'SSG 08 | Turbo Peek (Minimal Wear)',
  'Street Soldier | Phoenix',
  'M4A4 | The Emperor (Field-Tested)',
  'USP-S | Jawbreaker (Field-Tested)',
  'The Elite Mr. Muhlik | Elite Crew',
  'SG 553 | Anodized Navy (Factory New)',
  'Sawed-Off | Amber Fade (Factory New)',
  'Buckshot | NSWC SEAL',
  'M4A4 | Temukau (Minimal Wear)',
  'StatTrak™ Five-SeveN | Violent Daimyo (Factory New)',
  'USP-S | The Traitor (Minimal Wear)',
  'MAC-10 | Neon Rider (Minimal Wear)',
  'Glock-18 | Water Elemental (Field-Tested)',
  'AK-47 | Slate (Minimal Wear)',
  'M4A1-S | Nightmare (Minimal Wear)',
  'AWP | Hyper Beast (Field-Tested)',
  'Sawed-Off | Kiss♥Love (Field-Tested)',
  'USP-S | Cyrex (Factory New)',
  'MAC-10 | Stalker (Field-Tested)',
  'Five-SeveN | Case Hardened (Factory New)',
  'StatTrak™ M4A4 | Temukau (Field-Tested)',
  'AWP | Atheris (Factory New)',
  'AK-47 | Head Shot (Minimal Wear)',
  'AWP | Duality (Minimal Wear)',
  'USP-S | Jawbreaker (Well-Worn)',
  'AK-47 | Wasteland Rebel (Field-Tested)',
  'USP-S | Printstream (Battle-Scarred)',
  'M4A1-S | Basilisk (Minimal Wear)',
  'M4A1-S | Leaded Glass (Minimal Wear)',
  'AWP | Asiimov (Battle-Scarred)',
  'AK-47 | Inheritance (Minimal Wear)',
  'AK-47 | The Outsiders (Battle-Scarred)',
  'Desert Eagle | Mecha Industries (Factory New)',
  'AWP | Atheris (Minimal Wear)',
  'M4A1-S | Player Two (Field-Tested)',
  'M4A4 | Buzz Kill (Field-Tested)',
  'SSG 08 | Dragonfire (Field-Tested)',
  'Desert Eagle | Crimson Web (Field-Tested)',
  'P250 | See Ya Later (Factory New)',
  'M4A1-S | Cyrex (Minimal Wear)',
  'AK-47 | Ice Coaled (Minimal Wear)',
  'Chem-Haz Capitaine | Gendarmerie Nationale',
  'M4A4 | Desolate Space (Field-Tested)',
  'MP9 | Mount Fuji (Field-Tested)',
  'Tec-9 | Fuel Injector (Minimal Wear)',
  'M4A1-S | Decimator (Field-Tested)',
  'M4A1-S | Nitro (Minimal Wear)',
  'FAMAS | Commemoration (Minimal Wear)',
  'P250 | See Ya Later (Field-Tested)',
  'Glock-18 | Neo-Noir (Field-Tested)',
  'AK-47 | Point Disarray (Minimal Wear)',
  'Galil AR | Tuxedo (Factory New)',
  'UMP-45 | Blaze (Factory New)',
  'Enforcer | Phoenix',
  'USP-S | Night Ops (Factory New)',
  'MP7 | Anodized Navy (Factory New)',
  'FAMAS | Teardown (Factory New)',
  'Desert Eagle | Meteorite (Factory New)',
]

const init = async () => {
  const response = await getVercelSearchMarketRender({
    query: 'Sticker',
    proxy: 'api-next-gateway2',
    start: 500,
  })

  console.log(response.total_count)
}

init()

// const ACTIVE_BARGAINS = new Set<string>()

// const generateFees = (diff: number, steps = 5): number[] => {
//   return Array.from({ length: steps }, (_, i) => parseFloat(((diff / steps) * (i + 1)).toFixed(2)))
// }

// const init = async () => {
//   const bargains = await getSentBargain({})

//   for (const bargain of bargains.data.items) {
//     const diffCreateCancelInMinutes = getDifferenceInMinutes(bargain.can_cancel_time, bargain.created_at)

//     if (
//       diffCreateCancelInMinutes < 5 &&
//       bargain.can_cancel_timeout < -1 &&
//       !ACTIVE_BARGAINS.has(bargain.sell_order_id)
//     ) {
//       ACTIVE_BARGAINS.add(bargain.sell_order_id)

//       console.log('bargain.created_at', bargain.created_at)
//       console.log('bargain.can_cancel_time', bargain.can_cancel_time)

//       await postCancelBargain({ bargain_id: bargain.id })
//       await sleep(3_000)

//       const original_price = Number(bargain.original_price)

//       const fees = generateFees((original_price - Number(bargain.price)) * original_price >= 50 ? 0.3 : 0.2)

//       console.log('Fees:', fees)

//       for (const fee of fees) {
//         const price = Number((Number(bargain.price) + fee).toFixed(2))
//         const preview = await getCreatePreviewBargain({ sell_order_id: bargain.sell_order_id, price })
//         const isFailed = preview.data?.pay_confirm?.id === 'bargain_higher_price'

//         console.log(bargain.goods_id, fee, isFailed ? 'failed' : 'success')

//         if (!isFailed) {
//           await postCreateBargain({ sell_order_id: bargain.sell_order_id, price })
//           break
//         }

//         await sleep(3_000)
//       }
//     }
//   }

//   await sleep(10_000)

//   init()
// }

// init()
