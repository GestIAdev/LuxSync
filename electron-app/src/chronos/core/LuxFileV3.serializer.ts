/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💾 LUX FILE V3 — SERIALIZER (with SHA-256 integrity)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Serialize / deserialize `.lux` V3 with deterministic, key-sorted canonical
 * JSON and a SHA-256 checksum. Works in both the renderer (Web Crypto) and the
 * main process / tests (Node webcrypto fallback).
 *
 * The checksum is computed over the canonical content with the `checksum` field
 * set to '' — so the result is idempotent and verifiable.
 *
 * @module chronos/core/LuxFileV3.serializer
 * @version V3.0
 */

import { type LuxFileV3 } from './LuxFileV3'
import { validateLuxFileV3, type LuxValidationResult } from './LuxFileV3.schema'

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL JSON (deterministic key order)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Stable stringify: object keys sorted alphabetically at every depth so the
 * checksum is independent of property insertion order. Arrays keep their order.
 */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value))
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(src).sort()) {
      out[key] = sortKeysDeep(src[key])
    }
    return out
  }
  return value
}

// ═══════════════════════════════════════════════════════════════════════════
// SHA-256 (universal)
// ═══════════════════════════════════════════════════════════════════════════

/** Compute a SHA-256 hex digest of a UTF-8 string. */
export async function sha256Hex(input: string): Promise<string> {
  // Web Crypto (renderer + modern Node via globalThis.crypto)
  const g = globalThis as { crypto?: { subtle?: SubtleCrypto } }
  if (g.crypto?.subtle) {
    const data = new TextEncoder().encode(input)
    const digest = await g.crypto.subtle.digest('SHA-256', data)
    return bufferToHex(new Uint8Array(digest))
  }

  // Node fallback
  const nodeCrypto = await import('node:crypto')
  return nodeCrypto.createHash('sha256').update(input, 'utf8').digest('hex')
}

function bufferToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Compute the canonical checksum for a file (with checksum stripped).
 * Returns a 'sha256:<hex>' prefixed string.
 */
export async function computeLuxChecksum(file: LuxFileV3): Promise<string> {
  const canonical = canonicalStringify({ ...file, checksum: '' })
  const hex = await sha256Hex(canonical)
  return `sha256:${hex}`
}

// ═══════════════════════════════════════════════════════════════════════════
// SERIALIZE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Serialize a LuxFileV3 to a pretty JSON string, embedding a fresh checksum.
 * The returned JSON has the checksum field populated; the in-memory `file` is
 * NOT mutated.
 */
export async function serializeLuxV3(file: LuxFileV3): Promise<string> {
  const checksum = await computeLuxChecksum(file)
  const withChecksum: LuxFileV3 = { ...file, checksum }
  return JSON.stringify(withChecksum, null, 2)
}

// ═══════════════════════════════════════════════════════════════════════════
// DESERIALIZE
// ═══════════════════════════════════════════════════════════════════════════

export interface LuxDeserializeResult {
  /** Parsed + validated file, or null on hard failure. */
  file: LuxFileV3 | null
  /** Structural validation result. */
  validation: LuxValidationResult
  /** True if the embedded checksum matched the recomputed one. */
  checksumValid: boolean
}

/**
 * Parse a `.lux` JSON string, validate structure, and verify checksum.
 *
 * Policy is left to the caller: a structurally valid file with a bad checksum
 * still returns `file` (so the operator can choose to load anyway), but flags
 * `checksumValid: false`.
 */
export async function deserializeLuxV3(json: string): Promise<LuxDeserializeResult> {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch (err) {
    return {
      file: null,
      validation: {
        valid: false,
        errors: [`JSON parse error: ${(err as Error).message}`],
        warnings: [],
      },
      checksumValid: false,
    }
  }

  const validation = validateLuxFileV3(data)
  if (!validation.valid) {
    return { file: null, validation, checksumValid: false }
  }

  const file = data as LuxFileV3

  // Verify checksum (recompute over content with checksum stripped).
  let checksumValid = false
  if (file.checksum) {
    const recomputed = await computeLuxChecksum(file)
    checksumValid = recomputed === file.checksum
    if (!checksumValid) {
      validation.warnings.push(
        `Checksum mismatch: file is '${file.checksum}', recomputed '${recomputed}'`
      )
    }
  }

  return { file, validation, checksumValid }
}

/**
 * Verify that a file's embedded checksum is correct.
 */
export async function verifyLuxChecksum(file: LuxFileV3): Promise<boolean> {
  if (!file.checksum) return false
  const recomputed = await computeLuxChecksum(file)
  return recomputed === file.checksum
}
