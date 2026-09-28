# LuxSync — notas para agentes

## Verificación (electron-app/)

- Tests Theia: `npx vitest run src/theia`
- Typecheck main/backend: `npx tsc --noEmit -p tsconfig.node.json`
- Typecheck renderer: `npx tsc --noEmit -p tsconfig.json`
- Espejos JS en `dist-electron-backend/src/**` se mantienen a mano junto a su
  `.ts` (no se regeneran solos): validar con `node --check <archivo>.js`.
  El worker, GenRuntime, TelemetrySmoother y opusLibrary van por Vite — sin espejo.

## Átomos GLSL (electron-app/assets/shaders/)

- Contrato de autor: `docs/theia/SHADER_ATOM_BASE.md` (copia idéntica en `docs/blueprints/`).
- Validar / migrar al contrato v2 (compilación real con glslangValidator del Vulkan SDK):
  - `node scripts/migrate_atoms_v2.js --check` (CI: exit 1 si algo no es v2 o no compila)
  - `node scripts/migrate_atoms_v2.js --dir <carpeta>` para shaders externos (dry-run)
  - `--write` aplica, `--diff` muestra las líneas tocadas.
- Átomo nuevo: registrarlo en `src/theia/shader/atoms/opusLibrary.ts` y en los
  IDs de `OpusLibrary.test.ts`.

## Diagnóstico de telemetría en vivo (WAVE 8281-RECON)

- Monitor ~10 Hz dentro de `TelemetrySmoother.step()` — imprime raw→out de
  página B, relojes (`u_vocalTime`/`u_beatTime` con tasa/s) y la réplica
  exacta de `euTimbre()`. Se activa en runtime, sin rebuild:
  - worker (pipeline principal): consola devtools → contexto del worker →
    `self.__EUCLID_TEL_DIAG__ = true`
  - página (TheiaOutputView modo B): `window.__EUCLID_TEL_DIAG__ = true`
  - apagar: `__EUCLID_TEL_DIAG__ = 0`
- Coste apagado: una lectura de propiedad por frame (zero-alloc intacto).
