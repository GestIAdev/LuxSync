# WAVE 4726 — CLEAN SWEEP & ATOMIC WIRING
### Reporte de Ejecución

**Commit:** `5d3cdfeb`  
**Branch:** `v3`  
**Fecha:** 2026-05-13  
**Archivos modificados:** 13 (450 inserciones / 538 eliminaciones)

---

## 1. Objetivo de la Directiva

Tres fases encadenadas:

| Fase | Objetivo | Resultado |
|------|----------|-----------|
| FASE 1 | Erradicar los 5 errores `TS2353` en `NodeExtractionPipeline.ts` | ✅ 0 errores |
| FASE 2 | Refactorizar `IntensitySection`, `ColorSection`, `BeamSection` y `DeviceCellGroup` para consumir directamente el store multi-célula vía `CapabilityContext<F>` | ✅ Completo |
| FASE 3 | Estética visual `ROLE_NEON` — `var(--neon-base, #a855f7)` en badges, borders y sliders | ✅ Aplicado |

---

## 2. Contexto Previo

La WAVE 4725 había identificado la arquitectura objetivo: cada sección de control (`IntensitySection`, `ColorSection`, `BeamSection`) debería poder leer y escribir el store directamente sin pasar datos como props desde el padre. El adaptador `DeviceCellGroup` tenía la responsabilidad de leer el store y construir props por cada sección — creando un acoplamiento innecesario y duplicando la lógica.

La sesión arrancó con FASE 1 ya identificada (root cause documentado): `_buildForgeGroupNode()` retornaba `ICapabilityNode | null` en vez del union discriminado real, lo que activaba `TS2353` excess-property checking en los 5 subtipos concretos.

---

## 3. Ejecución Paso a Paso

### FASE 1 — `NodeExtractionPipeline.ts`

**Problema:** La firma de retorno de `_buildForgeGroupNode()` era `ICapabilityNode | null`. TypeScript aplicaba excess-property checking sobre los campos específicos de cada subtipo (`IColorNodeData`, `IImpactNodeData`, etc.) y lanzaba `TS2353` en los 5 return paths discriminados.

**Solución:** Cambiar la firma de retorno al union explícito:

```typescript
// Antes
): ICapabilityNode | null

// Después
): IColorNodeData | IImpactNodeData | IKineticNodeData | IBeamNodeData | IAtmosphereNodeData | null
```

Los 5 imports ya existían en el archivo — cambio quirúrgico de 1 línea. Verificado con `npx tsc --noEmit | Select-String "NodeExtractionPipeline"` → salida vacía.

---

### FASE 2 — Refactor de Secciones

#### 2.1 Arquitectura nueva

Cada sección pasa de consumir props planas a recibir un único `ctx: CapabilityContext<F>` y leer/escribir el store directamente:

```typescript
// Props antes (ejemplo IntensitySection — 13 props)
interface IntensitySectionProps {
  value: number | null
  hasOverride: boolean
  strobeValue: number | null
  hasStrobeOverride: boolean
  limitValue: number | null
  hasLimitActive: boolean
  isExpanded: boolean
  onToggle: () => void
  onChange: (value: number) => void
  onRelease: () => void
  onStrobeChange: (value: number) => void
  onStrobeRelease: () => void
  onLimitChange: (value: number) => void
  onLimitRelease: () => void
}

// Props después (3 props)
interface IntensitySectionProps {
  ctx: CapabilityContext<NodeFamily.IMPACT>
  isExpanded: boolean
  onToggle: () => void
}
```

El store se lee directamente dentro de la sección:

```typescript
const ov = useProgrammerStore(s => s.cellOverrides.get(ctx.cellKey))
const data = ov?.payload.family === NodeFamily.IMPACT ? ov.payload.data : {}
```

#### 2.2 `IntensitySection.tsx`

- Props: 13 → 3
- Store: `setCellImpact(cellKey, channel, percent)` / `releaseCell(cellKey)`
- IPC limits: `window.lux?.aether?.setInhibitLimit([...ctx.nodeIds], v / 100)` / `clearInhibitLimit`
- Todos los handlers de release actualizados a `useProgrammerStore.getState().releaseCell(ctx.cellKey)`

#### 2.3 `ColorSection.tsx`

- Props: 6 → 3
- Store: `setCellColor(cellKey, r, g, b)` / `releaseCell(cellKey)`
- Valores RGB: `data.r !== undefined ? Math.round(data.r * 255) : null`
- `hasOverride` derivado: `data.r !== undefined || data.g !== undefined || data.b !== undefined`

#### 2.4 `BeamSection.tsx`

- Props: 4 → 3
- Eliminado: `useSelectedArray`, `useHardware`, `fixtureOverrides`, `hasBeamFixtures`, `shouldRender`
- Store: `setCellBeam(cellKey, channel, value0_255)` / `releaseCell(cellKey)`
- `hasOverride` derivado: `Object.keys(data).length > 0`
- `currentGoboStep` convertido a `useMemo` estático sobre `[gobo]`

#### 2.5 `DeviceCellGroup.tsx`

Eliminado el rol de adaptador. El componente ya no lee el store ni construye props para las secciones. Pasa `ctx` directamente usando el patrón de doble cast:

```typescript
// El switch garantiza la familia en runtime — el cast es seguro
<IntensitySection
  ctx={cell as unknown as CapabilityContext<NodeFamily.IMPACT>}
  isExpanded={isExpanded}
  onToggle={() => toggleSection(sectionKey)}
/>
```

Imports eliminados: `ImpactCellPayload`, `ColorCellPayload`, `BeamCellPayload`, `useProgrammerStore`.

Prop eliminada: `onOverrideChange?: (hasOverride: boolean) => void`.

#### 2.6 `TheProgrammer.tsx`

Dos problemas a resolver:

1. La llamada a `DeviceCellGroup` pasaba `onOverrideChange={handleBeamOverrideChange}` — prop que ya no existe en la interfaz.
2. El bloque legacy fallback usaba `IntensitySection`, `ColorSection` y `BeamSection` con las props antiguas que habían sido eliminadas.

**Decisión arquitectónica:** Las 3 secciones refactorizadas solo existen en contexto de `DeviceCellGroup` (requieren `ctx: CapabilityContext<F>` que solo se puede construir desde un `CellDescriptor` real). En la rama legacy — fixtures sin nodeGraph — estas secciones no pueden renderizarse. El fallback queda como mensaje informativo + `ExtrasSection` (que no fue refactorizada):

```tsx
) : (
  <>
    {/* LEGACY FALLBACK: no hay nodeGraph */}
    <div className="programmer-section" style={{ ... }}>
      Fixtures sin perfil Aether — selecciona fixtures con nodeGraph activo.
    </div>
    <ExtrasSection ... />
  </>
)}
```

Handlers dead-code eliminados: `handleBeamOverrideChange`, `handleColorChange`, `handleColorRelease`, `hasColorFixtures`.

Handlers dead-code dejados (no causan errores TS, scope futuro): `handleDimmerChange`, `handleDimmerRelease`, `handleStrobeChange`, `handleStrobeRelease`, `handleLimitChange`, `handleLimitRelease`.

---

### FASE 3 — CSS `var(--neon-base, #a855f7)`

Archivo: `electron-app/src/components/hyperion/controls/TheProgrammer.css`

| Selector | Cambio |
|----------|--------|
| `.programmer-section` | Añadido `border-left: 2px solid transparent` + transición |
| `.programmer-section.has-override` | `border-left-color: var(--neon-base)` + glow interno |
| `.override-badge` | Era amber `#ff8c00` → neon purple. Border + color + `box-shadow` |
| `.intensity-slider::-webkit-slider-thumb` | Era `var(--accent-cyan)` → `var(--neon-base)` |
| `.beam-slider::-webkit-slider-thumb` | Era dorado `#ffd700` → `var(--neon-base)` |

Criterio de diseño: el `var(--neon-base, #a855f7)` actúa como señal visual única para "hay override activo en esta célula". Antes cada section usaba un color distinto (cyan, amber, dorado) sin coherencia semántica.

---

## 4. Problemas Encontrados

### P1 — `{isExpanded && (` tragado por un edit en `BeamSection`

Durante el refactor de `BeamSection`, una operación `replace_string_in_file` solapó el bloque condicional de expansión. El componente renderizaba el body sin importar el estado del acordeón. Se detectó en revisión del JSX resultante y se restauró la condición `{isExpanded && (` antes de continuar.

**Lección:** En secciones con cierres anidados de múltiples niveles, verificar siempre el balance de `{` después de operaciones de reemplazo.

---

### P2 — `CellDescriptor` no assignable a `CapabilityContext<NodeFamily.X>`

`CellDescriptor.family` es `NodeFamily` (el union completo). `CapabilityContext<NodeFamily.IMPACT>.family` es `NodeFamily.IMPACT` (literal type). TypeScript rechaza la asignación directa.

```
Type 'NodeFamily' is not assignable to type 'NodeFamily.IMPACT'
```

El cast `cell as CapabilityContext<NodeFamily.IMPACT>` falla por la misma razón. La solución es el doble cast vía `unknown`:

```typescript
cell as unknown as CapabilityContext<NodeFamily.IMPACT>
```

Seguro en runtime porque el `switch` en `DeviceCellGroup` garantiza que cuando llega al caso `IMPACT`, el `cell.family` es `NodeFamily.IMPACT`. TypeScript no puede inferirlo estáticamente desde el switch — es una limitación del narrowing en JSX.

---

### P3 — Terminal PowerShell con comportamiento errático en captura de output

Durante la verificación final `npx tsc --noEmit 2>&1 | Select-String "error TS"`, el terminal retornaba la línea del comando en vez de la salida. El patrón funcional fue ejecutar `npx tsc --noEmit 2>&1` directamente sin pipe — la salida vacía confirma 0 errores.

---

### P4 — `selectedFixtures` quedó como variable sin uso tras eliminar `hasColorFixtures`

`hasColorFixtures` usaba `selectedFixtures` como dependencia. Al eliminar `hasColorFixtures`, `selectedFixtures` quedó sin consumidores. No fue eliminada en esta wave para no encadenar más cambios en el scope — no genera error TS porque `useMemo` con resultado sin usar no es `noUnusedLocals`-reportable en la configuración actual.

---

## 5. Verificación Final

```
npx tsc --noEmit
→ (sin salida) = 0 errores TypeScript
```

13 archivos cambiados:
- 538 líneas eliminadas (la mayoría: props antiguas, adaptadores de store, handlers dead-code)
- 450 líneas insertadas (las secciones nuevas son más cortas — el código real hace más con menos)

---

## 6. Deuda Técnica Residual

| Item | Impacto | Prioridad |
|------|---------|-----------|
| `handleDimmerChange/Release`, `handleStrobeChange/Release`, `handleLimitChange/Release` en `TheProgrammer.tsx` — handlers definidos, nunca llamados | Cero en runtime, ruido visual en el código | Baja |
| `selectedFixtures` sin consumidor en `TheProgrammer.tsx` | Cero en runtime | Baja |
| `ExtrasSection` no refactorizada — aún usa props planas | Inconsistencia arquitectónica | Media |
| Legacy fallback muestra mensaje de texto sin UI de recuperación | UX incompleta para fixtures sin nodeGraph | Media |

---

## 7. Próximos Pasos Sugeridos

- **WAVE 4727:** Refactorizar `ExtrasSection` al mismo patrón `ctx: CapabilityContext<NodeFamily.EXTRAS>` para completar la arquitectura uniforme.
- **WAVE 4728:** Limpiar handlers residuales en `TheProgrammer.tsx` + eliminar `selectedFixtures` huérfano.
- **Futuro:** Legacy fallback podría mostrar un selector de fixtures o guía para activar el nodeGraph en lugar del mensaje estático.
