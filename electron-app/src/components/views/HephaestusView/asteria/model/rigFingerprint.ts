/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 RIG FINGERPRINT — WAVE 8030-P3: HUELLA DETERMINISTA DEL RIG
 *
 * Blueprint §5.2: `rigFingerprint = sha1(nodeIds ordenados)`. La huella se
 * hornea en el proyecto al crearlo y se compara con el atlas vivo al abrir
 * un `.lfx` — si difieren, el Rig Drift Report lista los nodeIds que el
 * proyecto espera y ya no existen (y los nuevos sin coreografía).
 *
 * SHA-1 implementado en TS puro: `node:crypto` no existe en el renderer
 * (sin nodeIntegration) y `crypto.subtle.digest` es asíncrono — el sello
 * debe poder calcularse de forma síncrona al cargar el atlas/proyecto.
 *
 * @module HephaestusView/asteria/model/rigFingerprint
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// SHA-1 — implementación compacta (RFC 3174), UTF-8 in → 40 hex out
// ═══════════════════════════════════════════════════════════════════════════

const utf8 = new TextEncoder()

function sha1Hex(message: string): string {
  const bytes = utf8.encode(message)
  const ml = bytes.length

  // Padding: msg || 0x80 || zeros || uint64 bit-length → múltiplo de 64
  const padded = new Uint8Array((((ml + 8) >> 6) + 1) << 6)
  padded.set(bytes)
  padded[ml] = 0x80
  const dv = new DataView(padded.buffer)
  dv.setUint32(padded.length - 8, Math.floor(ml / 0x20000000)) // bitLen hi
  dv.setUint32(padded.length - 4, ml * 8)                      // bitLen lo (<2^32)

  const w = new Int32Array(80)
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0

  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getInt32(i + t * 4)
    for (let t = 16; t < 80; t++) {
      const v = w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16]
      w[t] = (v << 1) | (v >>> 31)
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4
    for (let t = 0; t < 80; t++) {
      let f: number, k: number
      if (t < 20)      { f = (b & c) | (~b & d);       k = 0x5a827999 }
      else if (t < 40) { f = b ^ c ^ d;                k = 0x6ed9eba1 }
      else if (t < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc }
      else             { f = b ^ c ^ d;                k = 0xca62c1d6 }
      const tmp = (((a << 5) | (a >>> 27)) + f + e + k + w[t]) | 0
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = tmp
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0
    h3 = (h3 + d) | 0; h4 = (h4 + e) | 0
  }

  return [h0, h1, h2, h3, h4]
    .map((h) => (h >>> 0).toString(16).padStart(8, '0'))
    .join('')
}

// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Huella determinista del rig: `sha1:` + SHA-1 de los nodeIds ordenados
 * lexicográficamente y unidos con '\n'. El orden de entrada NO importa —
 * el mismo set de nodos produce la misma huella aunque el atlas llegue
 * en otro orden (re-patch, topología reindexada).
 *
 * Patch-time only: la ordenación copia el array — nunca se llama a 44 Hz.
 */
export function computeRigFingerprint(nodeIds: readonly string[]): string {
  if (nodeIds.length === 0) return ''
  const sorted = nodeIds.slice().sort()
  return `sha1:${sha1Hex(sorted.join('\n'))}`
}
