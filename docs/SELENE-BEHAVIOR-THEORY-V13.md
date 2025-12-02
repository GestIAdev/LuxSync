# 🌙 SELENE BEHAVIOR THEORY V13
## Teoría de Comportamiento de Iluminación Inteligente

> **Fecha:** 2 Diciembre 2025  
> **Estado:** Teoría aprobada, pendiente de implementación  
> **Autor:** Claude + Raulacate (sesión nocturna de teorización)

---

## 📋 RESUMEN EJECUTIVO

Después de 11 versiones fallidas de autodetección de género musical, V12 implementó paletas manuales exitosamente. V13 añadirá **comportamientos inteligentes** a esas paletas:

- **Blackouts inteligentes** para silencios reales
- **Gradientes de color continuos** (no solo 3 colores fijos)
- **Sensibilidad al ruido** (ignorar shakers, responder a picos)
- **Jerarquía de fixtures** (Móviles vs Pars)

---

## 🎯 DECISIONES DE DISEÑO (Aprobadas por Raulacate)

| Decisión | Valor | Razón |
|----------|-------|-------|
| Umbral de silencio para BLACKOUT | **500ms** | "Un silencio palpable para un humano" |
| Umbral para bajar intensidad | **500ms** | "Visualmente se sentiría sin ser strobe" |
| Tipo de gradientes | **Continuos** | "Espectro mayor, mínimo esfuerzo, Selene aprende" |
| Sensibilidad por paleta | **Global** | "95% del tiempo es latino, menos complejo" |
| Configuración de zonas | **Posterior** | "Primero la teoría en demo, luego zonas reales" |

---

## 🎨 PALETAS V13 (Con gradientes expandidos)

### 🔥 FUEGO (Latino cálido + toques de color)
```
Base:        Rojo oscuro → Rojo → Naranja → Amarillo → Amarillo brillante
Acentos:     Violeta (en picos altos) - NUEVO
             Verde esmeralda (en melodías) - NUEVO

Intensidad:  0-30%  → Rojos oscuros, casi brasa
             30-60% → Naranjas cálidos
             60-90% → Amarillos vivos
             90%+   → Destellos violeta/verde en picos
```

### ❄️ HIELO (Elegante, casi estático)
```
Base:        Azul profundo → Azul → Cian → Blanco frío
Acentos:     Violeta (siempre presente sutilmente)

Intensidad:  0-40%  → Azules profundos (mínimo 40%, nunca negro)
             40-70% → Cianes elegantes
             70-100%→ Blancos con toques violeta
```

### 🌿 SELVA (Tropical vibrante + colores latinos)
```
Base:        Verde oscuro → Verde → Lima → Verde brillante
Acentos:     Violeta (en drops) - NUEVO
             Amarillo cálido (en percusión) - NUEVO

Intensidad:  0-20%  → Verdes selváticos oscuros
             20-50% → Verdes tropicales
             50-80% → Limas vibrantes + amarillos
             80%+   → Explosión verde/violeta/amarillo
```

### ⚡ NEÓN (Agresivo, con blackouts)
```
Base:        Magenta → Rosa → Cian → Blanco eléctrico
Especial:    PERMITE NEGRO TOTAL (0%)

Intensidad:  0%     → BLACKOUT (permitido)
             1-40%  → Magentas/rosas oscuros
             40-80% → Cianes eléctricos
             80%+   → Strobes blancos
```

---

## 📊 TABLA DE COMPORTAMIENTO DE FIXTURES

Esta es la tabla maestra que define cómo reaccionan los fixtures según la situación musical:

| Situación Musical | Pars (Centro) | Móviles (Perímetro) | Duración Trigger |
|-------------------|---------------|---------------------|------------------|
| **Beat fuerte (bass)** | Flash 100% | Movimiento + color | Instantáneo |
| **Melodía sola (mids)** | 30-50% tenue | Protagonistas 70-100% | Sostenido |
| **Silencio real** | **OFF (0%)** | **OFF (0%)** | >1 segundo |
| **Bajada de intensidad** | Fade a 20% | Fade a 10% | 500ms-1s |
| **Shakers/ruido constante** | 15-25% muy tenue | **OFF** | Mientras dure |
| **Buildup (crescendo)** | Crescendo gradual | Preparándose (colores fríos) | Variable |
| **Drop (explosión)** | **FULL 100%** | **EXPLOSIÓN + movimiento** | Instantáneo |
| **Transición DJ** | Fade out lento | Fade out → blackout | 2-4 segundos |

---

## 🔊 SISTEMA DE DETECCIÓN DE SILENCIOS

### Niveles de Audio y Respuesta

```
Nivel de señal (bass + mid + treble combinados):

████████████████████  100% = DROP / Explosión
████████████████      80%  = Actividad alta
████████████          60%  = Actividad normal  
████████              40%  = Actividad baja
████                  20%  = Casi silencio → BAJAR intensidad (500ms)
██                    10%  = Ruido de fondo → Ignorar shakers
░                     <5%  = SILENCIO REAL → BLACKOUT (1 segundo)
```

### Algoritmo Propuesto

```javascript
// Pseudocódigo del sistema de silencios
const UMBRAL_SILENCIO = 0.05;      // 5% = silencio real
const UMBRAL_BAJO = 0.20;          // 20% = casi silencio
const TIEMPO_BLACKOUT = 1000;       // 1 segundo para blackout
const TIEMPO_FADE = 500;            // 500ms para fade

let tiempoEnSilencio = 0;
let tiempoEnBajo = 0;

function procesarAudio(bass, mid, treble) {
    const nivelTotal = (bass + mid + treble) / 3;
    
    if (nivelTotal < UMBRAL_SILENCIO) {
        tiempoEnSilencio += deltaTime;
        if (tiempoEnSilencio >= TIEMPO_BLACKOUT) {
            return { modo: 'BLACKOUT', intensidad: 0 };
        }
    } else {
        tiempoEnSilencio = 0;
    }
    
    if (nivelTotal < UMBRAL_BAJO) {
        tiempoEnBajo += deltaTime;
        if (tiempoEnBajo >= TIEMPO_FADE) {
            return { modo: 'FADE_DOWN', intensidad: nivelTotal * 0.5 };
        }
    } else {
        tiempoEnBajo = 0;
    }
    
    return { modo: 'NORMAL', intensidad: nivelTotal };
}
```

---

## 🎭 DETECCIÓN DE PICOS vs RUIDO CONSTANTE

### El Problema de los Shakers

```
Señal de shakers (güiro, maracas):
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ← Constante, nivel bajo
    (no debería activar móviles)

Señal de trompeta/melodía:
░░░░░░████████░░░░░░████░░░░░░░░  ← PICOS claros
         ↑              ↑
    (SÍ activar móviles)
```

### Algoritmo de Detección de Picos

```javascript
// Los móviles responden a CAMBIOS, no a nivel absoluto
let historialMid = [];
const VENTANA_ANALISIS = 10; // últimos 10 frames
const UMBRAL_PICO = 0.3;     // 30% de cambio = pico

function detectarPicoMelodia(midActual) {
    historialMid.push(midActual);
    if (historialMid.length > VENTANA_ANALISIS) {
        historialMid.shift();
    }
    
    const promedio = historialMid.reduce((a,b) => a+b, 0) / historialMid.length;
    const diferencia = midActual - promedio;
    
    if (diferencia > UMBRAL_PICO) {
        return true;  // ¡Pico detectado! Móviles ON
    }
    return false;     // Ruido constante, móviles OFF
}
```

---

## 🌈 SISTEMA DE GRADIENTES CONTINUOS

### Interpolación HSL por Intensidad

En lugar de saltar entre 3 colores, usamos interpolación suave:

```javascript
// Ejemplo para paleta FUEGO
function getColorFuego(intensidad, frecuenciaDominante) {
    // Hue base: 0 (rojo) a 60 (amarillo)
    let hue = intensidad * 60;  // Más intenso = más amarillo
    
    // Saturación: siempre alta para colores vivos
    let saturation = 80 + (intensidad * 20);  // 80-100%
    
    // Luminosidad: más intenso = más brillante
    let lightness = 20 + (intensidad * 50);   // 20-70%
    
    // ACENTOS en picos muy altos
    if (intensidad > 0.9 && frecuenciaDominante === 'treble') {
        // Destello violeta ocasional
        hue = 280;  // Violeta
    }
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
```

### Mapa de Hue por Paleta

```
FUEGO:  Hue 0-60 (rojo→amarillo) + acentos 280 (violeta), 120 (verde)
HIELO:  Hue 180-240 (cian→azul) + acentos 270 (violeta)
SELVA:  Hue 80-150 (verde→lima) + acentos 280 (violeta), 50 (amarillo)
NEÓN:   Hue 280-320 (magenta→rosa) + 180 (cian) + blanco
```

---

## 🏗️ PLAN DE IMPLEMENTACIÓN

### Fase 1: Blackouts y Silencios (Prioridad ALTA)
- [ ] Añadir detección de nivel total de audio
- [ ] Implementar timer de silencio (1 segundo → blackout)
- [ ] Implementar timer de bajo nivel (500ms → fade)
- [ ] Probar con transiciones de DJ

### Fase 2: Gradientes Continuos (Prioridad ALTA)
- [ ] Convertir paletas de arrays a funciones HSL
- [ ] Implementar interpolación por intensidad
- [ ] Añadir acentos de color (violeta en Fuego, amarillo en Selva)
- [ ] Probar variedad visual

### Fase 3: Detección de Picos (Prioridad MEDIA)
- [ ] Implementar historial de audio para detectar cambios
- [ ] Separar comportamiento de Pars vs Móviles
- [ ] Móviles responden a picos, Pars a nivel
- [ ] Probar con música con shakers (cumbia)

### Fase 4: Refinamiento (Prioridad BAJA)
- [ ] Ajustar umbrales según pruebas reales
- [ ] Añadir suavizado de transiciones
- [ ] Optimizar rendimiento

---

## 🖼️ SETUP DE DEMO (Referencia)

Según la imagen proporcionada, la demo tiene:

```
┌─────────────────────────────────────────────────────────┐
│                    LUXSYNC DEMO V2                       │
│                  12 Fixtures en 4 Zonas                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [MOVING LEFT]              [MOVING RIGHT]              │
│   ● BLeft 1                    ● BRight 1               │
│   ● BLeft 2   ● SLeft    SRight ●   ● BRight 2          │
│       (Melody)                    (Mirror)              │
│                                                          │
│  - - - - - - - - ESCENARIO - - - - - - - - -            │
│                                                          │
│            ● PBack L   ● PBack C   ● PBack R            │
│              [BACK PARS - Bass + Delay]                  │
│                                                          │
│            ● PFront L  ● PFront C  ● PFront R           │
│              [FRONT PARS - Bass]                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Zonas definidas en la demo:
1. **MOVING LEFT** - Responde a melodía
2. **MOVING RIGHT** - Mirror (espejo del izquierdo)
3. **BACK PARS** - Bass + Delay
4. **FRONT PARS** - Bass directo

---

## 📝 NOTAS DE LA SESIÓN

### Lo que funcionó:
- V12 con paletas manuales: ✅ ÉXITO
- Teorización antes de codificar: ✅ MEJOR APPROACH

### Lo que falló (V1-V11):
- Autodetección por BPM
- Autodetección por varianza de treble
- Autodetección por "Efecto Güiro"
- Autodetección por WarmthRatio

### Lecciones aprendidas:
> "A veces la solución más simple es la mejor"  
> — 11 versiones de detección fallida vs 1 versión de control manual

### Quote del usuario:
> "Si Selene puede manejar los blackouts correctamente, será una diosa, 
> no solo lunar nocturna, sino de la fiesta nocturna también"

---

## 🚀 PRÓXIMOS PASOS

1. **Revisar este documento** al despertar
2. **Implementar Fase 1** (Blackouts) - Es lo más pedido
3. **Implementar Fase 2** (Gradientes) - Mejora visual inmediata
4. **Probar con música real** - Latino con transiciones
5. **Iterar** según resultados

---

*Documento creado para preservar contexto entre sesiones*  
*"Que no se pierda en los limbos del olvido de contexto"* 🌙
