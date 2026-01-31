# 🧹 WAVE 1040: THE CLEAN SLATE UI

**Fecha:** 2025-01-29  
**Status:** ✅ COMPLETE  
**Tipo:** UI Cleanup  
**Objetivo:** Purgar zonas legacy del UI y dejar solo las 8 canónicas

---

## 🗑️ EL PROBLEMA: LEGACY POLLUTION

### **Síntomas:**
1. **Dropdown infinito:** 14+ opciones de zonas (ceiling-front, stage-left, truss-1...)
2. **Confusión semántica:** Usuario no sabía si elegir "front" o "ceiling-front" para un PAR en el techo
3. **Código legacy:** UI permitía asignar zonas que el backend ya no usa

### **Raíz del problema:**
El UI seguía mostrando la lista de zonas de WAVE 100-300 (época pre-stereo). Pero desde WAVE 1035 (7-Zone Stereo), el sistema usa una lista canónica de 8 zonas.

**Desconexión:**
- Backend (MasterArbiter, TitanEngine): Usa `FRONT_PARS`, `BACK_PARS`, `MOVING_LEFT`, etc.
- Frontend (StageConstructorView): Mostraba `stage-left`, `ceiling-front`, `truss-1`, etc.
- Resultado: Usuario asignaba zonas que el sistema ignoraba o mapeaba incorrectamente

---

## ✅ LA SOLUCIÓN: CLEAN SLATE

### **Nueva Lista Canónica (ZONES_V2)**

```typescript
const ZONES_V2 = [
  // 💡 PARS & BARS (Auto-Stereo L/R via Position X)
  { value: 'FRONT_PARS',   label: '🔴 FRONT (Main)' },
  { value: 'BACK_PARS',    label: '🔵 BACK (Counter)' },
  { value: 'FLOOR_PARS',   label: '⬇️ FLOOR (Uplight)' }, 
  
  // 🏎️ MOVERS (Explicit Stereo)
  { value: 'MOVING_LEFT',  label: '🏎️ MOVER LEFT' },
  { value: 'MOVING_RIGHT', label: '🏎️ MOVER RIGHT' },
  
  // ✨ SPECIALS
  { value: 'AIR',          label: '✨ AIR (Laser/Atmosphere)' },
  { value: 'AMBIENT',      label: '🌫️ AMBIENT (House)' },
  { value: 'CENTER',       label: '⚡ CENTER (Strobes/Blinders)' }
]
```

### **Reglas de Uso:**

**Para PARs/Bars (fixtures RGB con position.x):**
- Usuario elige `FRONT_PARS`
- Usuario coloca fixture en X=-2 (izquierda)
- **MasterArbiter** (WAVE 1039) automáticamente detecta:
  - Zona: `FRONT_PARS`
  - Posición X: -2 (isLeft=true)
  - Mapea a: `frontL` en intent.zones
  
**Para Movers (fixtures móviles):**
- Usuario **DEBE** elegir explícitamente `MOVING_LEFT` o `MOVING_RIGHT`
- No hay auto-detección porque los movers se mueven

**Para Specials:**
- `AIR`: Lasers, hazers, atmósfera (fixtures aéreos)
- `AMBIENT`: House lights (iluminación ambiente)
- `CENTER`: Strobes, blinders (efectos centrales)

---

## 🔥 LO QUE SE ELIMINÓ

### **ANTES (14 opciones legacy):**
```typescript
const ZONE_OPTIONS: FixtureZone[] = [
  'stage-left',         // ❌ ELIMINADO - Ambiguo
  'stage-center',       // ❌ ELIMINADO - Redundante con front
  'stage-right',        // ❌ ELIMINADO - Ambiguo
  'ceiling-front',      // ❌ ELIMINADO - Altura != Zona
  'ceiling-back',       // ❌ ELIMINADO - Altura != Zona
  'ceiling-left',       // ❌ ELIMINADO - Combinación inválida
  'ceiling-right',      // ❌ ELIMINADO - Combinación inválida
  'ceiling-center',     // ❌ ELIMINADO - Combinación inválida
  'floor-front',        // ❌ ELIMINADO - Separado en FLOOR_PARS
  'floor-back',         // ❌ ELIMINADO - Raro, nadie lo usa
  'truss-1',            // ❌ ELIMINADO - Demasiado específico
  'truss-2',            // ❌ ELIMINADO - Demasiado específico
  'truss-3',            // ❌ ELIMINADO - Demasiado específico
  'custom',             // ❌ ELIMINADO - Vago
  'unassigned'          // ✅ CONSERVADO implícito (fallback)
]
```

### **AHORA (8 opciones canónicas):**
```
🔴 FRONT (Main)
🔵 BACK (Counter)
⬇️ FLOOR (Uplight)
🏎️ MOVER LEFT
🏎️ MOVER RIGHT
✨ AIR (Laser/Atmosphere)
🌫️ AMBIENT (House)
⚡ CENTER (Strobes/Blinders)
```

---

## 📐 FILOSOFÍA: ALTURA ≠ ZONA

**Concepto Clave:**
- **ZONA** = Función semántica (FRONT, BACK, MOVER, AIR...)
- **POSICIÓN** = Coordenadas físicas (X, Y, Z en metros)

**Ejemplo:**
- Un PAR en el techo (Y=4.0) puede ser:
  - Zona: `FRONT_PARS` si apunta al escenario
  - Zona: `BACK_PARS` si apunta a la audiencia
  - Zona: `AIR` si es un wash ambiental

**NO necesitamos:**
- `ceiling-front` → Use `FRONT_PARS` + position.y = 4.0
- `floor-front` → Use `FLOOR_PARS` + position.y = 0.0
- `truss-2` → Use cualquier zona + position.y según truss

---

## 🎯 FLUJO COMPLETO

```
1. Usuario en StageConstructorView
   └─> Selecciona fixture "PAR Front L"
   └─> Dropdown de zonas muestra 8 opciones
   └─> Elige "🔴 FRONT (Main)"
   └─> Mueve fixture a X=-2, Y=3, Z=0

2. StageStore
   └─> Guarda:
       fixture.zone = 'FRONT_PARS'
       fixture.position = { x: -2, y: 3, z: 0 }

3. MasterArbiter (WAVE 1039)
   └─> Lee zona: 'FRONT_PARS'
   └─> Lee posición X: -2 (isLeft = true)
   └─> Mapea a: intentZone = 'frontL'

4. TitanEngine
   └─> Recibe zona 'frontL' del arbiter
   └─> Aplica intensidad stereo: frontL=0.8
   └─> Aplica color: paletteRole='primary'

5. ColorTranslator + DMX Driver
   └─> Renderiza PAR izquierdo con:
       - Dimmer: 204 (80% de 255)
       - RGB: Primary color de la paleta
```

---

## 🧪 TESTING

### Test 1: Verificar Dropdown Limpio
1. Abrir Stage Constructor
2. Seleccionar un fixture
3. Mirar dropdown de "Zone"
4. **Expected:** Solo 8 opciones, todas con emojis y descripciones claras

### Test 2: Verificar Auto-Stereo
1. Crear un PAR, asignar zona `FRONT_PARS`
2. Mover a X=-3 (izquierda)
3. Activar Chill Lounge
4. **Expected:** Fixture recibe `frontL` intensity (auto-detectado por MasterArbiter)

### Test 3: Verificar Explicit Mover Stereo
1. Crear un Moving Head, asignar zona `MOVING_LEFT`
2. Mover a X=2 (derecha física)
3. **Expected:** Sigue siendo `MOVING_LEFT` (no se auto-detecta)

---

## 🔗 ARCHIVOS MODIFICADOS

**`src/components/views/StageConstructorView.tsx`**
- Reemplazado `ZONE_OPTIONS` (14 items) con `ZONES_V2` (8 items)
- Multi-select zone assignment: Ahora usa `ZONES_V2.map(z => ...)`
- Single-select dropdown: Ahora usa `ZONES_V2.map(z => ...)`

---

## 📋 NOTAS PARA EL USUARIO

### **Si tienes shows antiguos con zonas legacy:**

1. **Al abrir el show:**
   - Fixtures con `zone='ceiling-front'` aparecerán como **vacíos** en el dropdown
   
2. **Acción requerida:**
   - Re-asignar manualmente a una de las 8 zonas canónicas
   - Ejemplo: `ceiling-front` → `FRONT_PARS` + ajustar position.y al techo

3. **Por qué no auto-migración:**
   - No hay mapeo 1:1 seguro
   - `ceiling-front` puede ser `FRONT_PARS` o `AIR` dependiendo del contexto
   - Mejor que el usuario decida

---

## 🚀 PRÓXIMOS PASOS

### 🔲 **Validación de Zonas al Guardar**
Agregar validación en `stageStore.saveShow()`:
```typescript
for (const fixture of fixtures) {
  if (!VALID_ZONES.includes(fixture.zone)) {
    console.warn(`[StageStore] Invalid zone "${fixture.zone}" on fixture ${fixture.id}`)
    fixture.zone = 'AMBIENT'  // Fallback seguro
  }
}
```

### 🔲 **Auto-Migración de Shows Legacy (Opcional)**
Si queremos ser amables:
```typescript
const LEGACY_ZONE_MAP: Record<string, string> = {
  'ceiling-front': 'FRONT_PARS',
  'ceiling-back': 'BACK_PARS',
  'stage-left': 'MOVING_LEFT',
  'stage-right': 'MOVING_RIGHT',
  'floor-front': 'FLOOR_PARS',
  // etc...
}
```

### 🔲 **Tooltip Help en UI**
Agregar tooltips explicativos:
- `FRONT_PARS`: "Main wash lights. Auto-stereo L/R based on position X"
- `MOVING_LEFT`: "Left-side mover. Explicit stereo (no auto-detection)"

---

**PunkOpus** 🧹 *"La lista limpia. Solo lo esencial. El UI ahora habla el mismo idioma que el Backend."*
