# 🔐 LFX Checksum Registry — Metodología & Registro de Incidentes

**WAVE:** 5018-C-FIX  
**Autor:** SONNET (Tactical Code Editor)  
**Fecha:** 2026-06-05  
**Estado:** Resuelto — procedimiento documentado para futuras WAVEs.

---

## 1. El Problema

Los archivos `.lfx` v2.1 declarados como `builtin` llevan un campo `checksum` (SHA-256 sobre el bloque `clip`). Al editar cualquier campo dentro de `clip` — `vibeCompat`, `compatibleVibes`, `tags`, curvas, etc. — el checksum deja de coincidir. El `LfxFileLoader` ejecuta el **Gate G2** (`_validateChecksum`) antes de registrar el efecto en el `DynamicEffectRegistry`:

```typescript
// LfxFileLoader.ts:240-244
if (!_validateChecksum(validated, raw, filePath)) {
  console.warn(`[LfxFileLoader ⚠️] G2 fail: checksum mismatch at ${filePath}`)
  return null  // ← Efecto rechazado. Invisible para Selene.
}
```

### 1.1 Impacto real observado

En WAVE 5018-C se corrigieron las etiquetas `vibeCompat` / `compatibleVibes` de cuatro efectos latinos (`latina_meltdown`, `solar_flare`, `tidal_wave`, `amazon_mist`) para que el `DynamicEffectRegistry` los indexara bajo `fiesta-latina`. Tres de ellos tenían `checksum` previo; tras la edición, **todos los checksums quedaron inválidos**. El próximo boot los hubiera rechazado silenciosamente, dejando el arsenal DIVINE vacío para latino.

> `tidal_wave.lfx` no declaraba `checksum` → no afectado. Los archivos **sin checksum pasan el Gate G2** (fail-open para user/dev).

---

## 2. ¿Cómo se calcula el checksum?

El `LfxFileLoader` no hashea el archivo JSON completo (incluyendo `$schema`, `version`, `checksum`); hashea **únicamente** el bloque `clip` re-serializado:

```typescript
// LfxFileLoader.ts:479-491
function _validateChecksum(clip: LfxClipV2, _raw: string, _filePath: string): boolean {
  if (!clip.checksum || clip.checksum.length === 0) return true  // sin checksum = OK
  try {
    const canonical = JSON.stringify(clip.clip)                    // ← solo el bloque clip
    const hash = createHash('sha256').update(canonical).digest('hex')
    const declaredHash = clip.checksum.startsWith('sha256:')
      ? clip.checksum.slice(7)
      : clip.checksum
    return hash === declaredHash
  } catch {
    return false
  }
}
```

**Reglas de canonicalización:**
- Objeto hasheado: `clip.clip` (todo el contenido del efecto).
- **NO** se incluye: `$schema`, `version`, ni el propio campo `checksum`.
- Sin pretty-print (`JSON.stringify` sin espacios).
- Encoding: UTF-8 → SHA-256 → hex.
- Prefijo esperado: `sha256:<hex>`.

---

## 3. Procedimiento de registro / recálculo

### 3.1 One-liner (Node.js)

Desde la raíz del repo, ejecutar para un archivo concreto:

```bash
node -e "
const fs = require('fs');
const crypto = require('crypto');
const raw = fs.readFileSync('electron-app/src/core/arsenal/builtins/latin/MI_EFECTO.lfx', 'utf8');
const parsed = JSON.parse(raw);
const canonical = JSON.stringify(parsed.clip);
const hash = 'sha256:' + crypto.createHash('sha256').update(canonical).digest('hex');
console.log(hash);
"
```

### 3.2 Batch (todos los .lfx de una carpeta)

```bash
node -e "
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dir = 'electron-app/src/core/arsenal/builtins/latin';
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.lfx'))) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed.checksum) continue;
  const canonical = JSON.stringify(parsed.clip);
  const computed = 'sha256:' + crypto.createHash('sha256').update(canonical).digest('hex');
  const ok = parsed.checksum === computed;
  console.log((ok ? '✅' : '❌') + ' ' + f + ' -> ' + (ok ? 'OK' : 'MISMATCH'));
}
"
```

### 3.3 Validación manual previa al commit

Siempre ejecutar el batch de validación después de editar cualquier `.lfx` con `checksum`. Si un archivo marca `❌ MISMATCH`, recalcular y actualizar el campo `checksum` antes de pushear.

---

## 4. Registro de checksums corregidos (WAVE 5018-C)

| Archivo | Estado previo | Checksum válido actual |
|---|---|---|
| `latin/latina_meltdown.lfx` | Inválido tras edición | `sha256:b8eef72aa6d34eb9c0ecf59f659bc0a05a35fec3245646ee9ba56ca740fde26d` |
| `latin/solar_flare.lfx` | Inválido tras edición | `sha256:c099929d48e4e0f173bef6be25413062e419cd695f8a363e04363e83a148c3a9` |
| `latin/amazon_mist.lfx` | Inválido tras edición | `sha256:b26a18a17e954d99107b1a068cd68917234fcaf848f99127e532154cd29963ee` |
| `latin/tidal_wave.lfx` | Sin campo `checksum` | N/A (no requiere) |

---

## 5. Recomendación arquitectónica

Si se prevé editar frecuentemente `.lfx` built-ins durante el desarrollo, considerar:

1. **Quitar los `checksum` de todos los built-ins** y dejarlos solo en `user-effects/` (donde la integridad es crítica). El Gate G2 ya falla-open cuando no hay checksum.
2. **O** añadir un paso de CI (`pre-commit` hook) que recalcule automáticamente los checksums de los `.lfx` modificados.

Opción 1 es más pragmática para el desarrollo ágil; Opción 2 es más segura para distribución firmada.

---

*Fin del registro.*
