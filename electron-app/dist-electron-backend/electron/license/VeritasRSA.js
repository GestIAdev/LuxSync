/**
 * WAVE 2489 — THE OBSIDIAN VAULT
 * VeritasRSA: Motor criptográfico extraído quirúrgicamente de Veritas.ts (Dentiagest)
 *
 * Solo firma y verificación RSA-2048/SHA-256 sobre payloads JSON deterministas.
 * Zero ZK Proofs. Zero Merkle Trees. Zero blockchain.
 * CommonJS exports para compatibilidad con bytenode.
 */
import crypto from 'crypto';
// ═══════════════════════════════════════════════════════════════════════════
// SERIALIZACIÓN DETERMINISTA
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Serializa el payload con claves alfabéticamente ordenadas.
 * Garantía: misma entrada → misma cadena → misma firma. Siempre.
 */
export function serializePayload(payload) {
    const ordered = {};
    const keys = Object.keys(payload).sort();
    for (const key of keys) {
        ordered[key] = payload[key];
    }
    return JSON.stringify(ordered);
}
/**
 * SHA-256 del payload serializado. Es el dato que se firma/verifica.
 */
export function hashPayload(payload) {
    const serialized = serializePayload(payload);
    return crypto.createHash('sha256').update(serialized).digest('hex');
}
// ═══════════════════════════════════════════════════════════════════════════
// FIRMA (solo para generate-license.ts — nunca se distribuye)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Firma un dataHash con clave privada RSA-2048.
 * Extraído de Veritas.ts → RealCryptoSignatures.signCertificate()
 */
export function rsaSign(dataHash, privateKeyPem) {
    const signature = crypto.sign('sha256', Buffer.from(dataHash), privateKeyPem);
    return signature.toString('hex');
}
// ═══════════════════════════════════════════════════════════════════════════
// VERIFICACIÓN (dentro de LicenseValidator — se compila a .jsc)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Verifica firma RSA-2048 con clave pública.
 * Extraído de Veritas.ts → RealCryptoSignatures.verifyCertificate()
 */
export function rsaVerify(dataHash, signatureHex, publicKeyPem) {
    return crypto.verify('sha256', Buffer.from(dataHash), publicKeyPem, Buffer.from(signatureHex, 'hex'));
}
// ═══════════════════════════════════════════════════════════════════════════
// VALIDACIÓN DE PAYLOAD
// ═══════════════════════════════════════════════════════════════════════════
const VALID_TIERS = ['DJ_FOUNDER', 'FULL_SUITE'];
/**
 * Valida la estructura del JSON de licencia. No verifica firma.
 */
export function validateLicenseStructure(data) {
    if (typeof data !== 'object' || data === null)
        return false;
    const obj = data;
    if (typeof obj.client !== 'string' || obj.client.length === 0 || obj.client.length > 128)
        return false;
    if (typeof obj.hardwareId !== 'string' || obj.hardwareId.length === 0)
        return false;
    if (typeof obj.tier !== 'string' || !VALID_TIERS.includes(obj.tier))
        return false;
    if (typeof obj.issuedAt !== 'string' || isNaN(Date.parse(obj.issuedAt)))
        return false;
    if (typeof obj.signature !== 'string' || obj.signature.length === 0)
        return false;
    return true;
}
