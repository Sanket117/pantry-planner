import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

// Solid background with a lighter rounded square inset — enough for an
// installable-icon placeholder; real artwork can replace these files later.
function makeIcon(size, { bg, fg, insetRatio }) {
  const raw = Buffer.alloc(size * (1 + size * 4))
  const inset = Math.round(size * insetRatio)
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4)
    raw[rowStart] = 0 // filter type: none
    for (let x = 0; x < size; x++) {
      const inner = x >= inset && x < size - inset && y >= inset && y < size - inset
      const [r, g, b] = inner ? fg : bg
      const px = rowStart + 1 + x * 4
      raw[px] = r
      raw[px + 1] = g
      raw[px + 2] = b
      raw[px + 3] = 255
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const idat = deflateSync(raw)

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const green = [22, 101, 52] // tailwind green-800
const cream = [245, 245, 244] // tailwind stone-100

writeFileSync(path.join(outDir, 'icon-192.png'), makeIcon(192, { bg: green, fg: cream, insetRatio: 0.28 }))
writeFileSync(path.join(outDir, 'icon-512.png'), makeIcon(512, { bg: green, fg: cream, insetRatio: 0.28 }))
// Maskable icons need the safe zone closer to the edge (~10%) since OSes crop to a shape.
writeFileSync(
  path.join(outDir, 'icon-512-maskable.png'),
  makeIcon(512, { bg: green, fg: cream, insetRatio: 0.12 }),
)

console.log('Generated icons in', outDir)
