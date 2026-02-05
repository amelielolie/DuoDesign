import { createCanvas, loadImage } from 'canvas'
import fs from 'fs'
import path from 'path'

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2

  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: h * 360, s, l }
}

function isBackground(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b)

  // Clearly warm-toned (skin, leather, brown boots) — keep
  const isWarm = (h <= 55 || h >= 320) && s > 0.12
  if (isWarm) return false

  // Very dark AND warm or neutral — hair, dark leather (keep)
  if (l < 0.08 && s < 0.15) return false // near-black neutral = hair

  // Blue/teal hue range — this IS background regardless of lightness
  if (h >= 140 && h <= 260 && s > 0.05) return true

  // Dark blue pixels (the ones that survive because they're very dark)
  if (h >= 140 && h <= 260 && l < 0.2) return true

  // Bright highlights that are not warm-toned
  if (l > 0.5 && !isWarm) return true

  // Grayish pixels that are not warm
  if (s < 0.15 && l > 0.2 && !isWarm) return true

  // Near-black with blue tint
  if (l < 0.15 && b > r * 1.1 && b > g) return true

  return false
}

async function processSprite(inputPath, outputPath) {
  const img = await loadImage(inputPath)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')

  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, img.width, img.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]

    if (isBackground(r, g, b)) {
      data[i + 3] = 0 // Set alpha to 0
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(outputPath, buffer)
  console.log(`Processed: ${path.basename(outputPath)} (${img.width}x${img.height})`)
}

const avatarDir = '/Users/amelienguyen/DuoDesign/duo-world/public/avatars'

await processSprite(
  path.join(avatarDir, 'sprite-walk.png'),
  path.join(avatarDir, 'sprite-walk-clean.png')
)
await processSprite(
  path.join(avatarDir, 'sprite-idle.png'),
  path.join(avatarDir, 'sprite-idle-clean.png')
)
await processSprite(
  path.join(avatarDir, 'sprite-jump.png'),
  path.join(avatarDir, 'sprite-jump-clean.png')
)
await processSprite(
  path.join(avatarDir, 'character.png'),
  path.join(avatarDir, 'character-clean.png')
)

console.log('Done! Background removed from all sprites.')
