# THEIA VENGINE 2.0 — Documento de Arquitectura de la Interfaz

> Blueprint UX/UI · Media Server híbrido (GLSL generativo + vídeo físico)
> Estado: PROPUESTA — sin código. Basado en el estado real del repo tras WAVE 8302.

---

## 0. Diagnóstico del layout actual

```
┌ HEADER 60px: logo · LIVE · OUTPUT · ········· LOAD ASSETS · LOAD PACK ┐
├───────────────────────────────────────────────┬───────────────────────┤
│ .theia-stage                                  │ Inspector 340px       │
│   Viewport (programa)                         │  1 Telemetry          │
│   TransportBar (siempre visible, atenuada     │  2 Masters (7 + BO)   │
│                 con shaders)                  │  3 Ecosystem (Darwin) │
│   LiveDeck (pack slots + tile grid)           │  3.4 Genetic faders   │
│                                               │  3.5 Shader params    │
└───────────────────────────────────────────────┴───────────────────────┘
```

Problemas estructurales:

1. **Una sola columna lateral mezcla dos trabajos distintos.** Los Masters sirven para *actuar en directo* y los faders genéticos para *diseñar*. Comparten scroll, y en pleno show el BLACKOUT o el STROBE pueden quedar fuera de pantalla.
2. **El LiveDeck es una galería, no un instrumento.** Sirve para explorar, pero no permite secuenciar: no hay orden, cola ni "lo siguiente".
3. **La TransportBar ocupa espacio fijo aunque no sirva.** Con un shader activo se queda atenuada: son píxeles muertos.
4. **No hay director explícito.** Selene (`SeleneTheiaBridge.forceState`) conmuta estados de forma autónoma, el operador dispara átomos a mano, y un futuro Auto-Pilot sería un tercer actor. Hoy nadie arbitra entre ellos.

---

## 1. Principios de diseño

| # | Principio | Consecuencia |
|---|---|---|
| P1 | **Lo que salva un show nunca se esconde.** | BLACKOUT, LIVE, GO/NEXT y Masters son inamovibles en modo PERFORM. |
| P2 | **Un espacio, un contexto.** | Transporte de vídeo y faders genéticos comparten el mismo hueco (Context Strip) y se alternan según el medio. |
| P3 | **Un único director cada vez.** | Árbitro explícito MANUAL / PLAYLIST / SELENE, siempre visible en el header. |
| P4 | **Explorar ≠ secuenciar ≠ emitir.** | Tres zonas: Browser (explorar) → Playlist (secuenciar) → Program (emitir). |
| P5 | **Ningún panel colapsado consume CPU.** | Colapsar = desmontar o pausar sus bucles rAF (disciplina WAVE 8295). |
| P6 | **Teclado y MIDI primero.** | Toda acción de directo tiene `data-midi-bind` y atajo. El ratón es secundario. |

---

## 2. Sistema de modos: PERFORM · DESIGN

Hay dos *workspaces* completos, no dos pestañas dentro de un panel. Se cambia con un switch segmentado en el header o con la tecla **`Tab`**. La transición redimensiona la grid; **nunca** reinicia el render ni la playlist.

| | **PERFORM** (show) | **DESIGN** (preparación / laboratorio) |
|---|---|---|
| Objetivo | Emitir, secuenciar, reaccionar | Crear, mutar, curar packs |
| Program viewport | Grande (~62% del ancho) | Medio (~45%) |
| Masters | Columna fija vertical, siempre visible | Colapsados a un rail de 36px |
| Playlist | Lane principal, expandida | Una línea (cola compacta) |
| Media Browser | Drawer inferior, plegado por defecto | Panel principal, expandido |
| Inspector genético | Solo macros en el Context Strip | Inspector completo con pestañas |
| Telemetría | Micro-HUD en el header | Pestaña completa del Inspector |

El layout de cada modo (tamaños y paneles plegados) se persiste por separado, igual que el resto de preferencias de UI.

---

## 3. Wireframe — Modo PERFORM (referencia 1920×1080)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER 44px                                                                              │
│ ◉THEIA [● LIVE] [OUTPUT▾] │ [PERFORM|design] │ DIRECTOR: [MANUAL|▶PLAYLIST|SELENE]        │
│   ▁▂▅▇▅▂ DROP 0.82 · 128.0 BPM · ▮▮▮▯ bar 3/4 │ 60fps · GPU 41% │ ◉BO           │
├───────────────────────────────────────────────────────────────┬──────────────────────────┤
│ PROGRAM  (≈62% ancho · 16:9)                                  │ CUE / NEXT  (≈18%)       │
│ ┌───────────────────────────────────────────────────────────┐ │ ┌──────────────────────┐ │
│ │                                                           │ │ │  [thumbnail estático]│ │
│ │                  SALIDA EN DIRECTO                        │ │ │  glsl_liquid_nebula  │ │
│ │                                                           │ │ │  GEN · 32 bars       │ │
│ │  overlay: nombre del átomo · tipo · tiempo en pantalla    │ │ └──────────────────────┘ │
│ └───────────────────────────────────────────────────────────┘ │ [  ◀ PREV ][ GO ▶ NEXT ] │
│ ┌ CONTEXT STRIP 56px (cambia según medio, §5) ──────────────┐ │ transición: [X-FADE▾]    │
│ │ VIDEO:  ⏮ ⏯ ⏭  ━━━━━━━●━━━━━━━━━  01:12 / 03:40  [LOOP]   │ │ ░░░░░░░░ 2.0s            │
│ │ SHADER: G1▮▮▯ G2▮▯▯ G3▮▮▮ G4▮▯▯ │ ⟳MUTATE ♥FAV ✕SKIP │ ⏱██▒ │ │                          │
│ └───────────────────────────────────────────────────────────┘ ├──────────────────────────┤
│                                                               │ MASTERS (≈20%, fijo)     │
│                                                               │ BRI SPD CON SAT HUE STR  │
│                                                               │  ┃   ┃   ┃   ┃   ┃   ┃   │
│                                                               │  ┃   ┃   ┃   ┃   ┃   ┃   │
│                                                               │ 85% 1.0 1.0 1.0 0.0 OFF  │
│                                                               │ ┌──────────────────────┐ │
│                                                               │ │    ◉  BLACKOUT  [␣]  │ │
│                                                               │ └──────────────────────┘ │
├───────────────────────────────────────────────────────────────┴──────────────────────────┤
│ AUTO-PILOT BAR 36px                                                                      │
│ [■ OFF|▶ SEQ|⟲ LOOP|⤨ SHUFFLE] · DWELL [ 32 bars ▾] · QUANT [phrase▾] · X-FADE [2.0s]      │
│ ··········································· ⏱ próxima transición en 12.4 bars ███████▒▒▒  │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ PLAYLIST LANE ≈150px  (scroll horizontal · drag para reordenar · drop desde Browser)     │
│ ┌──────┐┌──────┐┏━━━━━━┓┌──────┐┌──────┐┌──────┐┌──────┐┌─ ─ ─ ┐                          │
│ │01 GEN││02 VID│┃03 GEN┃│04 GEN││05 VID││06 MUT││07 GEN││ drop │                          │
│ │aether││intro ││ ▶LIVE ││nebula││loop_b││#8812 ││voxel ││ here │                          │
│ │32bar ││ 0:45 │┃ 32bar ┃│ CUE  ││ 2:10 ││16bar ││ 32bar│└─ ─ ─ ┘                          │
│ └──────┘└──────┘┗━━━━━━┛└──────┘└──────┘└──────┘└──────┘                                 │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ▸ MEDIA BROWSER (drawer plegado · 28px)  [PACKS] [VIDEO] [MUTATIONS] [🔍]      ↻ RESCAN  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Dimensiones relativas (PERFORM):**

- Filas: `44px | 1fr (program) | 36px (autopilot) | 150px (playlist) | 28px o 40% (drawer)`.
- Columnas de la zona superior: `≈62% program | ≈18% cue | ≈20% masters`. Las dos columnas de la derecha se apilan en una sola de 340px en pantallas de 1440px o menos.
- Con el drawer abierto (tecla `B`), el Browser sube hasta un 40% de la altura y **encoge la Playlist, no el Program**. El Program tiene prioridad de espacio.

### Justificación de las decisiones clave

- **CUE con thumbnail estático, no un preview en vivo.** Un segundo render en tiempo real duplicaría el coste GPU del worker. El problema original (720 MB en HQ, micro-cortes) desaconseja pagar ese precio. `TheiaThumbBuffer` ya existe y encaja aquí. Un preview en vivo de baja resolución puede ser una opción futura, desactivada por defecto.
- **Masters verticales y fijos.** Es la convención de las mesas de luces (GrandMA, faders de Resolume): lectura instantánea de un vistazo y mapeo 1:1 con controladores MIDI físicos. Los faders horizontales dentro de un panel con scroll no son aptos para directo.
- **BLACKOUT como botón grande con el atajo visible `[␣]`.** Reutiliza el atajo global de WAVE 8302.

---

## 4. Wireframe — Modo DESIGN

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER 44px   ◉THEIA [● LIVE] [OUTPUT▾] │ [perform|DESIGN] │ DIRECTOR: MANUAL (forzado*) │
├──────────────────────────────────────────┬───┬───────────────────────────────────────────┤
│ PROGRAM (≈45%)                           │ M │ INSPECTOR (≈45%) — pestañas                │
│ ┌──────────────────────────────────────┐ │ A │ [GENOME] [PARAMS] [ECOSYSTEM] [TELEMETRY]  │
│ │                                      │ │ S │ ┌───────────────────────────────────────┐ │
│ │                                      │ │ T │ │ GENOME · glsl_aether_serpent#8812     │ │
│ └──────────────────────────────────────┘ │ E │ │ G_FOLD  ━━━━━━●━━━━  8                │ │
│ CONTEXT STRIP (mismo componente, §5)     │ R │ │ G_ZOOM  ━━●━━━━━━━━  0.21             │ │
│                                          │ S │ │ G_WARP  ━━━━━━━━●━━  3.1              │ │
│                                          │   │ │ …                                     │ │
│                                          │ r │ │ [⟳ MUTATE] [⚭ CROSSOVER] [♥] [✕]      │ │
│                                          │ a │ │ [＋ ADD TO PLAYLIST] [💾 SAVE TO PACK] │ │
│                                          │ i │ └───────────────────────────────────────┘ │
│                                          │ l │                                           │
├──────────────────────────────────────────┴───┴───────────────────────────────────────────┤
│ MEDIA BROWSER (≈45% alto) — el LiveDeck actual, promovido a panel principal              │
│ [PACKS ▾ Factory · mi-pack · loose]  [VIDEO]  [MUTATIONS]   🔍 filtro · vibe · zona      │
│ ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐                   │
│ │tile││tile││tile││tile││tile││tile││ ✕  ││ ✕  ││tile││tile││tile││tile│  …                │
│ └────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘                   │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ PLAYLIST (1 línea, 32px): 01 aether · 02 intro · ▶03 · 04 nebula · …  [expandir ▴]        │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Rail de Masters (36px):** faders en miniatura, solo lectura con arrastre fino, más el BLACKOUT. Siguen siendo accesibles, conforme a P1.
- **DIRECTOR forzado a MANUAL (*):** al entrar en DESIGN, el Auto-Pilot y Selene pasan a HOLD. Nadie debe cambiar el átomo mientras lo estás editando. Si se entra en DESIGN *con el LIVE en salida*, se pide confirmación, o se ofrece "DESIGN en blind" (ver §8, recomendación 5).
- **Pestaña TELEMETRY:** es la sección Live Telemetry actual a tamaño completo. En PERFORM queda reducida al micro-HUD del header (sparkline + zona + BPM), con los mismos refs rAF y sin rerenders de React.

---

## 5. Lógica de interacción: el Context Strip

El Context Strip es **un único slot de 56px bajo el Program** que se transforma según el tipo del medio activo. La señal ya existe: `useTheiaTransportStore.hasVideo` + `atom.source.kind`.

### 5.1 Máquina de estados

```
                 playAtom(kind='video')
      ┌────────────────────────────────────────────┐
      │                                            ▼
 ┌─────────┐  playAtom(kind='shader')   ┌───────────────────┐
 │  IDLE   │ ─────────────────────────▶ │  SHADER           │
 │(builtin)│ ◀──── stop / blackout ──── │  Genetic Strip    │
 └─────────┘                            └───────────────────┘
      ▲                                     │         ▲
      │ stop                   playAtom(video)     playAtom(shader)
      │                                     ▼         │
      │                                 ┌───────────────────┐
      └──────────────────────────────── │  VIDEO            │
                                        │  Transport Strip  │
                                        └───────────────────┘
```

| Estado | Contenido del Context Strip | Notas |
|---|---|---|
| **VIDEO** | `⏮ PREV · ⏯ PLAY/PAUSE · ⏭ NEXT` · **Seek Bar** · timecode `mm:ss / mm:ss` · `LOOP` · marcadores de trim IN/OUT | La seek bar se muestra **solo aquí**. Scrub absoluto (`seekTransport`). |
| **SHADER** | 4–6 **macro-faders** (los genes con más peso) · `⟳ MUTATE` `♥ FAV` `✕ SKIP` · **barra de dwell** (tiempo restante hasta la auto-transición) | La barra de progreso *no desaparece*: pasa de "posición en el clip" a "posición en el dwell". El operador siempre ve cuándo llega el siguiente cambio. |
| **IDLE** | Mensaje `NO SOURCE — GO para iniciar playlist` + botón GO | Estado builtin/plasma. |
| **BLACKOUT** | El strip se mantiene pero se cubre con un velo rojo `BLACKOUT ACTIVE` | No se pierde el contexto al volver. |

**Transición visual:** crossfade de opacidad de 150ms entre las dos variantes, con altura constante (56px). No debe haber *layout shift*: el Program no puede saltar al cambiar de medio.

**PREV / NEXT existen en ambos estados.** Operan sobre la **playlist**, no sobre el vídeo. En el Transport Strip de vídeo se muestran junto a Play/Pause; en el Genetic Strip, a la derecha junto a la barra de dwell. La semántica es la misma en todos los medios.

### 5.2 Qué pasa con los faders genéticos cuando suena un vídeo

- **PERFORM:** desaparecen, porque el strip pasa a Transport.
- **DESIGN:** las pestañas GENOME y PARAMS muestran un estado vacío informativo ("El medio activo es vídeo — sin genoma"). En su lugar, la pestaña PARAMS ofrece los ajustes de clip de vídeo: trim IN/OUT, velocidad y modo de loop.

### 5.3 Paso de shader a vídeo en mitad de una edición

Si el operador está moviendo un fader genético y el Auto-Pilot cambia a un vídeo, **el Auto-Pilot no conmuta mientras haya un fader agarrado** (pointer capture activo o un CC MIDI recibido en los últimos 500ms). La transición espera y la barra de dwell muestra `HELD`. Así nunca se pierde un gesto a mitad.

---

## 6. Playlist + Motor Auto-Pilot

### 6.1 Modelo de la playlist (conceptual)

Cada ítem guarda:

- `id` del ítem. Es único y distinto del átomo, porque el mismo átomo puede aparecer varias veces.
- `atomRef`:
  - Átomo de disco → `atomId`.
  - **Mutación → `{ coreId, seed }`.** `spawnGenomeVariant` es determinista, así que una mutación borrada de la sesión (WAVE 8302 `removeAtom`) o perdida en un reinicio **se regenera idéntica** al llegar su turno. La playlist no depende de la memoria de sesión.
  - Vídeo → ruta del archivo (no la blob URL; la ruta sobrevive a reinicios).
- `dwell` opcional: override del global. En vídeo, el valor por defecto es "hasta el final" (o hasta el OUT de trim).
- `transition` opcional: override de tipo y duración del crossfade.
- Flags: `skip` (en la lista pero excluido del ciclo) y `pinned` (Shuffle nunca lo mueve).

Estado visual de cada tarjeta:

| Estado | Marca |
|---|---|
| LIVE | Borde sólido `#39FF14` + ▶ |
| CUE (siguiente) | Borde discontinuo fósforo + etiqueta CUE |
| Ya reproducido | Opacidad 50% en SEQ/SHUFFLE |
| Huérfano (archivo borrado, core ausente) | Borde rojo + ⚠. El Auto-Pilot **lo salta** sin detenerse. |
| Skip | Tachado |

Persistencia: `userData/theia/playlists/<nombre>.theiaplaylist.json`, con el mismo patrón que los packs de WAVE 8299 (escritura atómica tmp+rename, fail-silent). Opcionalmente, embebida en el show `.lux` para que un show traiga su visual.

### 6.2 Modos del Auto-Pilot

| Modo | Comportamiento al terminar el dwell | Al llegar al final |
|---|---|---|
| **■ OFF** | Nada. El operador pulsa GO/NEXT. | — |
| **▶ SEQ** (continuo) | Avanza al siguiente | Se queda en el último ítem (hold). No vuelve a negro. |
| **⟲ LOOP** | Avanza al siguiente | Vuelve al ítem 01 |
| **⤨ SHUFFLE** | Salta a un ítem aleatorio | Baraja de nuevo |

**SHUFFLE usa "bolsa", no un aleatorio puro.** Se baraja la lista completa (Fisher-Yates), se consume entera y se vuelve a barajar, con la regla de que **el primero de la nueva bolsa no puede ser el último de la anterior**. El aleatorio puro repite ítems y deja otros sin salir nunca, y eso se nota en un show.

### 6.3 Tiempo de auto-transición

- **DWELL** en **compases** (por defecto, sincronizado al BPM de LuxSync) o en **segundos** (fallback sin audio). Unidad conmutable: `[32 bars ▾]` / `[45 s ▾]`.
- **QUANT** (cuantización del corte): `off` · `beat` · `bar` · `phrase`. Con `phrase`, al cumplirse el dwell se espera al siguiente límite de frase. Los cortes caen en el downbeat, que es lo que distingue un VJ profesional de un salvapantallas.
- **X-FADE:** duración (0–8s) y tipo. Hoy existe el crossfade (`crossfadeMs`); cut, fade-to-black y otros tipos quedan como extensiones futuras del worker.
- **La transición al drop tiene prioridad** (opción `DROP SNAP`, activada por defecto). Si la telemetría señala un drop inminente (`dropImminent`/APPROACH), el Auto-Pilot adelanta el corte para que el cambio coincida con el impacto, aunque el dwell no haya terminado.

### 6.4 El árbitro: quién dirige (crítico)

`SeleneTheiaBridge` ya conmuta estados de forma autónoma. Por eso el header muestra **DIRECTOR** con tres fuentes excluyentes:

| Director | Quién elige el siguiente medio | Cuándo cambia |
|---|---|---|
| **MANUAL** | El operador (clic en una tarjeta, GO, teclas 1–9) | Solo por acción humana |
| **PLAYLIST** | El Auto-Pilot, según el modo SEQ/LOOP/SHUFFLE | Dwell + cuantización |
| **SELENE** | La IA, con matching por vibe y zona **restringido a los ítems de la playlist** | Cambio estable de sección/energía (histéresis actual del bridge) |

Reglas:

1. **Take-over manual:** cualquier disparo manual gana siempre. El director activo pasa a `HOLD` durante una ventana configurable (por defecto 1 frase) y después se reanuda solo. Un indicador `⏸ HOLD 7.2 bars` en el header muestra el tiempo restante; pulsar el propio director lo reanuda al instante.
2. **SELENE usa la playlist como paleta.** No debe elegir entre todos los packs instalados: el operador cura la paleta y la IA la toca. Con la playlist vacía, SELENE recurre al pack `●live` (el comportamiento actual).
3. **BLACKOUT congela al director.** Durante el blackout no avanza nada. Al liberarlo, se sigue donde estaba.
4. **Solo un director escribe `playAtom` a la vez.** El resto de fuentes quedan silenciadas. Esto elimina las carreras entre Selene y la playlist.

### 6.5 Drag & drop

| Origen → destino | Resultado |
|---|---|
| Tile del Browser → Playlist Lane | Inserta en la posición del cursor (marcador fósforo vertical) |
| Tile del Browser → Program | Disparo inmediato (take-over manual) |
| Tile del Browser → CUE | Lo fija como siguiente sin alterar la playlist (one-shot) |
| Archivo del SO (.mp4, .glsl) → Playlist | Ingesta (vía `ingestFiles` actual) + inserción |
| Tarjeta de la Playlist → Playlist | Reordena |
| Tarjeta de la Playlist → fuera de la lane | Elimina de la playlist (el átomo sigue en el Browser) |
| Multi-selección (Shift/Ctrl) | Arrastre en bloque |
| Pack slot → Playlist | Inserta todos sus átomos en el orden de `atomOrder` |

---

## 7. Gestión del espacio (collapsibility)

### 7.1 Tres estados por panel

```
EXPANDED  →  RAIL (32–36px, iconos + valores clave)  →  HIDDEN (0px, solo atajo)
```

| Panel | PERFORM (defecto) | DESIGN (defecto) | Mínimo permitido |
|---|---|---|---|
| Masters | EXPANDED | RAIL | RAIL (P1: nunca HIDDEN) |
| CUE / NEXT | EXPANDED | HIDDEN | HIDDEN |
| Auto-Pilot Bar | EXPANDED | HIDDEN | RAIL (solo modo + countdown) |
| Playlist Lane | EXPANDED | RAIL (1 línea) | RAIL |
| Media Browser | RAIL (drawer) | EXPANDED | RAIL |
| Inspector | — (macros en el Strip) | EXPANDED | HIDDEN |
| Telemetría | Micro-HUD del header | Pestaña | Micro-HUD (nunca HIDDEN: el operador debe ver que hay audio) |

### 7.2 Reglas

- Los divisores entre paneles se pueden arrastrar, con snap a los tres estados. Doble clic sobre un divisor devuelve el panel a su tamaño por defecto.
- **Coste cero al colapsar:** un panel en RAIL o HIDDEN detiene sus rAF y sus suscripciones de alta frecuencia. La telemetría completa no se pinta si su pestaña no está visible, para evitar repetir la fuga de la auditoría original.
- Existe un preset **"FOCUS"** (tecla `F`) que muestra solo Program, Context Strip y Masters, para sets largos con poca interacción.
- Los tamaños se guardan por modo y por resolución de pantalla.

---

## 8. Recomendaciones de flujo para VJs profesionales

1. **Preparar en DESIGN y actuar en PERFORM, sin mezclarlos.** El flujo previo al show es: explorar packs y mutar en DESIGN → pulsar `＋ ADD TO PLAYLIST` sobre las mutaciones que merecen la pena → ajustar dwell y overrides por ítem → guardar la playlist. En el show se abre PERFORM y no se vuelve a DESIGN salvo emergencia.

2. **Curar la paleta y dejar que Selene toque.** El modo más potente para sets largos es DIRECTOR = SELENE sobre una playlist de 10–20 ítems con vibes coherentes. El operador interviene con take-overs en los momentos clave (drops, cambios de género) y el sistema vuelve solo a la IA tras una frase. Reparto del trabajo: la IA se encarga del "cuándo" y el humano del "qué" y los momentos de autor.

3. **Cuantizar siempre a frase en directo.** Un corte fuera de tiempo se nota más que un visual mediocre. QUANT = `phrase` + `DROP SNAP` activado como configuración por defecto de show.

4. **Los Masters son el instrumento; los genes, la partitura.** En directo, la expresividad debe salir de SAT/HUE/STROBE/BRIGHT, que son predecibles y de efecto inmediato, mapeados a un controlador MIDI físico. Los genes cambian la *identidad* del visual y conviene fijarlos durante la preparación. Por eso en PERFORM solo se exponen 4–6 macros.

5. **Añadir preview "blind" en una fase posterior.** Los media servers profesionales permiten editar lo siguiente sin que el público lo vea. El coste GPU hoy lo desaconseja (ver §3), pero la arquitectura debe dejar hueco: el panel CUE es el lugar natural para un render de baja resolución futuro, activable solo en máquinas con margen.

6. **Hacer los errores visibles, nunca bloqueantes.** Un ítem huérfano, un shader que no compila o un vídeo con códec no soportado se marcan en rojo en la playlist y se **saltan**. El show nunca se detiene por un asset roto (misma filosofía fail-silent que el scanner de WAVE 8299).

7. **Mapa de control mínimo** (teclado; MIDI con `data-midi-bind` equivalentes):

| Acción | Tecla | MIDI bind propuesto |
|---|---|---|
| BLACKOUT | `Space` | `theia.blackout` (existe) |
| GO / NEXT | `Enter` o `→` | `theia.playlist.next` |
| PREV | `←` | `theia.playlist.prev` |
| Play/Pause vídeo | `P` | `theia.transport.play` |
| Disparar ítem 1–9 | `1`…`9` | `theia.playlist.item.N` |
| Ciclar modo Auto-Pilot | `A` | `theia.autopilot.mode` |
| Ciclar director | `D` | `theia.director` |
| Reanudar tras HOLD | `R` | `theia.director.resume` |
| PERFORM ⇄ DESIGN | `Tab` | — (no se mapea a MIDI para evitar cambios accidentales) |
| Drawer del Browser | `B` | — |
| FOCUS | `F` | — |

Todos los atajos respetan la guardia de WAVE 8302: no se disparan dentro de inputs, textareas ni campos editables.

---

## 9. Hoja de ruta sugerida (por olas)

| Ola | Alcance | Riesgo |
|---|---|---|
| **A · Layout Shell** | Grid nueva, switch PERFORM/DESIGN, columna de Masters fija, estados EXPANDED/RAIL/HIDDEN. Sin funciones nuevas: solo se reubica lo existente. | Bajo |
| **B · Context Strip** | Fusión de TransportBar + macros genéticas en un solo slot con máquina de estados; barra de dwell. | Bajo |
| **C · Playlist (manual)** | Store de playlist, lane, drag & drop, GO/PREV/NEXT, CUE con thumbnail, refs `{coreId, seed}` para mutaciones. | Medio |
| **D · Auto-Pilot + Árbitro** | Motor SEQ/LOOP/SHUFFLE, dwell en compases, QUANT, DROP SNAP, DIRECTOR con take-over/HOLD, integración con `SeleneTheiaBridge`. **El motor vive fuera de React**, junto al orchestrator, y dirigido por el reloj de telemetría (no por `setInterval` de UI). | **Alto** (concurrencia de directores) |
| **E · Persistencia** | `.theiaplaylist.json` en userData, embebido opcional en `.lux`, layouts por modo. | Bajo |
| **F · (futuro) Blind Preview** | Render de baja resolución del CUE, opcional. | Alto (GPU) |

Se recomienda empezar por la **ola A**, porque da el mayor alivio de ergonomía sin tocar el motor. La **ola D** necesita su propio RECON previo: hay que auditar cómo `forceState` de Selene y `playAtom` manual comparten hoy el orchestrator antes de introducir un tercer actor.
