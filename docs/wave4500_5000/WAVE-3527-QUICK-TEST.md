# QUICK TEST PARA LA FIX WAVE 3527

**¿Qué se rompió?** La Matrix veía RGB(0,0,0) negro aunque hubiera audio real.
**¿Qué se filó?** Detectamos que el router Omni/non-Omni era frágil y perdía energía.
**¿Qué hicimos?** Agregamos un guard robusto basado en datos reales del Worker.

---

## TEST RÁPIDO (5 minutos)

### Prerequisitos
- [ ] VirtualWire instalado y conectado
- [ ] Track de audio preparado (ej: Boris Brejcha minimal techno — tiene kicks claros)
- [ ] Build limpio: `npm run build` en `electron-app/`

### ANTES de aplicar fix
Si tuvieras reproduciendo LuxSync antes:
- [ ] Abre VirtualWire como fuente de audio
- [ ] Play track
- [ ] ¿Ves RGB(0,0,0) negro cuando debería haber color? → **BUG CONFIRMADO**

### DESPUÉS de aplicar fix

1. **Compile:**
   ```bash
   cd electron-app
   npm run build
   ```
   (Ya lo hicimos. Si ves 0 errores de TypeScript → OK)

2. **Run:**
   ```bash
   npm run dev
   # O en Electron:
   npm run start
   ```

3. **Test audio:**
   - Abre panel de dispositivos
   - Elige VirtualWire como fuente
   - Play track (Boris Brejcha o algo con kicks claros)
   - Mira la consola del sistema (System bar en LuxSync):
     ```
     🎧 WAVE 3416: Audio LIVE via virtual-wire — Selene is now listening!
     ```
   - Mira el output de color/luz:
     - ¿Cambia cuando hay kicks?
     - ¿RGB ≠ [0,0,0]?
     - ¿Brillo va con la energía del audio?

### VALIDATION CHECKLIST

- [ ] **Logs:** `🎧 WAVE 3416: Audio LIVE via virtual-wire`
- [ ] **Color:** RGB output no es negro (0,0,0)
- [ ] **Reactivity:** Brillo sube/baja con análisis de audio
- [ ] **No regressions:** 
  - [ ] WebAudio path (si lo probas) sigue funcionando
  - [ ] Fronted frontend no se congela
  - [ ] Sin errores en DevTools console

---

## ¿QUÉ CAMBIÓ EN EL CÓDIGO?

**Archivo:** `electron-app/src/core/orchestrator/TitanOrchestrator.ts`

**Antes (línea 601):**
```typescript
const isOmniActive = activeSource ? OMNI_SOURCES.has(activeSource) : false
```
→ Si matriz falla, siempre = false (buggy)

**Después (línea 607–609):**
```typescript
const hasWorkerOmniMetrics = levels.rawBassEnergy !== undefined && levels.rawBassEnergy > 0
const isOmniActive = (activeSource ? OMNI_SOURCES.has(activeSource) : false) || hasWorkerOmniMetrics
```
→ Si Worker envía `rawBassEnergy` (Omni signal), el route es correcto incluso si matriz falla (robust)

---

## ¿Y SI ALGO EXPLOTA?

- **Error TypeScript:** Informa. El build debería estar 100% limpio.
- **Logs vacíos/no reactivos:** Verifica VirtualWire está corriendo en segundo plano
- **RGB sigue siendo [0,0,0]:** Verifica que no hay otra rama del código que esté zeroing energy
- **WebAudio broke:** Verifica que el non-Omni path sigue correctamente sin la energía Worker (Frontend tiene prioridad)

---

## SIGUIENTE PASO

Una vez confirmado que funciona:
- [ ] Git merge a `main`
- [ ] Tag release (v0.8.0 o similar)
- [ ] Build instalador final

---

**TL;DR:** Build, run, play audio con VirtualWire, verifica que los lights reaccionen y no veas negro. ✅ = éxito.

