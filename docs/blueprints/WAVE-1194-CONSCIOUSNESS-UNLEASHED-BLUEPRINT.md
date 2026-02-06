# 🌊 WAVE 1194: CONSCIOUSNESS UNLEASHED

## 📋 OBJETIVO
Reemplazar el HUD legado de 4 paneles compactos por la **ConsciousnessView expandida** con componentes titánicos que ocupan el 100% del espacio disponible.

---

## 🏗️ ARQUITECTURA

### Layout: CSS Grid 2x2 (50% width × 50% height cada panel)
```
┌─────────────────────────────────────────────────────────────┐
│                    CONSCIOUSNESS TAB                        │
├─────────────────────────────┬───────────────────────────────┤
│                             │                               │
│     🔮 ORACLE HYBRID        │     ⚖️ ETHICS COUNCIL        │
│     (50% × 50%)             │     (50% × 50%)               │
│                             │                               │
│  ┌─────────────────────┐    │  ┌─────────────┬──────────┐   │
│  │ 🔥 DROP INCOMING    │20% │  │ 🦋 BEAUTY   │ ✓ FOR    │   │
│  └─────────────────────┘    │  ├─────────────┼──────────┤   │
│  ┌─────────────────────┐    │  │ 🦊 ENERGY   │ ✓ FOR    │   │
│  │ ~~~~ SPARKLINE ~~~~ │50% │  ├─────────────┼──────────┤   │
│  │ (60 points history) │    │  │ 🐋 CALM     │ ✗ AGAINST│   │
│  └─────────────────────┘    │  └─────────────┴──────────┘   │
│  ┌─────────────────────┐    │   CONSENSUS: 67% ████████░░   │
│  │ ◄────●────────────► │30% │                               │
│  │ TREND GAUGE + ZONES │    │                               │
│  └─────────────────────┘    │                               │
│                             │                               │
├─────────────────────────────┼───────────────────────────────┤
│                             │                               │
│     🐱 AI STATE TITAN       │     🎨 DREAM FORGE COMPLETE   │
│     (50% × 50%)             │     (50% × 50%)               │
│                             │                               │
│  STATE: ⚡ STRIKING         │  ┌─────────────────────────┐  │
│  ┌──────────────────────┐   │  │ 💫 SHIMMER_CASCADE      │  │
│  │ CONFIDENCE ████████░ │   │  │ STATUS: CASTING         │  │
│  └──────────────────────┘   │  └─────────────────────────┘  │
│                             │                               │
│  🕐 Hunt: 12.4s             │  WHY: "Energy at 0.847,       │
│  🎯 Success: 87%            │   texture=ethereal matches    │
│  📈 Beauty: φ1.234 ↗        │   current emotional arc"      │
│                             │                               │
│  💭 THINKING:               │  HISTORY:                     │
│  "Energy rising steadily,   │  ├── 💫 Shimmer_Cascade      │
│   preparing for peak        │  ├── 🌊 Wave_Pulse           │
│   moment in 4-6 bars..."    │  ├── ✨ Sparkle_Burst        │
│                             │  └── 🎆 Starburst_Bloom      │
│                             │                               │
└─────────────────────────────┴───────────────────────────────┘
```

---

## 📦 COMPONENTES A CREAR

### Directorio: `src/components/views/ConsciousnessView/`

### 1. 🔮 OracleHybrid.tsx
**La Joya de la Corona** - Estabilidad visual total

**Secciones:**
- **Top (20%)**: Alert Banner - Solo aparece en DROP/SPIKE/BUILDUP
- **Mid (50%)**: Giant Sparkline - Siempre visible, 60 puntos de historia
- **Bottom (30%)**: Trend Gauge bidireccional + Zone badges

**Props:**
```tsx
interface OracleHybridProps {
  prediction: string | null
  probability: number
  energyTrend: 'rising' | 'falling' | 'stable' | 'spike'
  energyZone: 'calm' | 'rising' | 'peak' | 'falling'
  energyVelocity: number
  energyValue: number
  historyBuffer: number[]  // 60 puntos de historia
}
```

**Features:**
- Sparkline SVG nativo con gradiente de color (azul→verde→rojo)
- Peak markers en la sparkline
- Trend Gauge con thumb animado (-1 a +1)
- Zone badges: CALM | RISING | PEAK | FALLING

---

### 2. ⚖️ EthicsCouncilExpanded.tsx
**La Democracia Visible**

**Layout:** 3 tarjetas de voto verticales

**Votos:**
- 🦋 **BEAUTY** - ¿El efecto es estéticamente apropiado?
- 🦊 **ENERGY** - ¿El nivel de energía lo justifica?
- 🐋 **CALM** - ¿Respeta el bienestar del público?

**Cada tarjeta muestra:**
- Icono y nombre del votante
- Estado: ✓ FOR (verde) / ✗ AGAINST (rojo) / ◐ ABSTAIN (gris)
- Razón del voto (truncada, tooltip completo)

**Footer:**
- Consensus Score: Barra visual + porcentaje
- Verdict: APPROVED / BLOCKED / PENDING

---

### 3. 🐱 AIStateTitan.tsx
**El Cazador Expandido**

**Métricas nuevas:**
- **Hunt Duration**: Tiempo en estado actual (ej: "12.4s")
- **Success Rate**: % de strikes exitosos (ej: "87%")
- **Beauty Trend**: Mini-sparkline de belleza (8 puntos)

**Reasoning expandido:**
- Texto completo, no truncado
- Scroll interno si excede altura
- Animación de typing cuando cambia

---

### 4. 🎨 DreamForgeComplete.tsx
**El Historial de Sueños**

**Secciones:**
- **Header**: Efecto actual + status badge
- **Why Block**: Texto explicativo completo de por qué se eligió
- **History Queue**: Últimos 5 efectos con timestamp

**History Item:**
```
🎆 STARBURST_BLOOM  │ 2.3s ago │ CAST
💫 SHIMMER_CASCADE  │ 8.1s ago │ CAST
🌊 WAVE_PULSE       │ 15.2s ago │ BLOCKED
```

---

## 🎨 ICONOS CUSTOM NUEVOS

### Para OracleHybrid:
- `OracleEyeIcon` - Ojo místico con pupila brillante
- `SparklineIcon` - Mini gráfico de línea

### Para EthicsCouncil:
- `ButterflyBeautyIcon` - Mariposa estilizada (🦋)
- `FoxEnergyIcon` - Zorro alerta (🦊)
- `WhaleCalmIcon` - Ballena serena (🐋)
- `VoteForIcon` - Check circular con rayos
- `VoteAgainstIcon` - X circular con ondas

### Para AIStateTitan:
- `HourglassHuntIcon` - Reloj de arena con patas de gato
- `TrophySuccessIcon` - Trofeo con estrella

### Para DreamForgeComplete:
- `ScrollHistoryIcon` - Pergamino con líneas
- `WhyQuestionIcon` - Signo de interrogación luminoso

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
src/components/views/ConsciousnessView/
├── index.ts                    # Exports
├── ConsciousnessView.tsx       # Host component con CSS Grid 2x2
├── ConsciousnessView.css       
├── OracleHybrid.tsx            # 🔮 La Money Card
├── OracleHybrid.css
├── EthicsCouncilExpanded.tsx   # ⚖️ Los 3 votantes
├── EthicsCouncilExpanded.css
├── AIStateTitan.tsx            # 🐱 El Cazador
├── AIStateTitan.css
├── DreamForgeComplete.tsx      # 🎨 El Historial
└── DreamForgeComplete.css
```

---

## 🔗 INTEGRACIÓN

### NeuralCommandView.tsx
```tsx
// Actualizar import
import { ConsciousnessView } from '../ConsciousnessView'

// En el tab CONSCIOUSNESS:
{activeSubTab === 'consciousness' && (
  <ConsciousnessView />  // Reemplaza ConsciousnessHUD
)}
```

---

## ✅ CHECKLIST

- [ ] Crear directorio ConsciousnessView/
- [ ] Crear iconos custom en LuxIcons.tsx
- [ ] Implementar OracleHybrid
- [ ] Implementar EthicsCouncilExpanded  
- [ ] Implementar AIStateTitan
- [ ] Implementar DreamForgeComplete
- [ ] Crear ConsciousnessView host
- [ ] Actualizar NeuralCommandView
- [ ] Test visual
- [ ] Commit

---

**WAVE 1194: CONSCIOUSNESS UNLEASHED**
*"De HUD comprimido a cerebro visual titánico"*
