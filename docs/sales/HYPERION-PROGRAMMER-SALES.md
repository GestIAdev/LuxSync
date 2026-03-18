# 🎭 Hyperion & TheProgrammer — Tu Show, en Tiempo Real

**Documento:** Ficha de producto — Visualizador Hyperion + Control en Directo  
**Audiencia:** DJs, técnicos de iluminación, operadores de sala, artistas visuales  
**Versión:** Beta 1.0 — Marzo 2026

---

## Lo que ves es exactamente lo que sale al escenario

Hyperion es el LiveStage de LuxSync. La ventana donde el show existe antes de llegar a los fixtures — y donde tú tomas el control cuando quieres.

Dos modos, un solo clic para cambiar entre ellos:

**Vista 2D táctica** — plano cenital de tu rig con los fixtures posicionados exactamente donde están en el escenario. Clica en un fixture, lo seleccionas. Clica y arrastra, mueves grupos. Rápido, directo, sin ornamentos.

**Vista 3D inmersiva** — el escenario completo en tres dimensiones, en tiempo real, con los beams encendidos, los colores exactos, los moving heads orientados a donde realmente están apuntando. Lo que ves en Hyperion es lo que está pasando en el escenario — no una aproximación, no un preset visual. El estado real del DMX, renderizado a 60 fotogramas por segundo.

---

## Por qué el 3D importa de verdad

Existe una diferencia enorme entre un visualizador 3D decorativo y uno que te dice algo útil.

El de Hyperion es del segundo tipo.

Los **moving heads se mueven de verdad** — pan y tilt calculados con rotación cuaternión (sin gimbal lock, el problema clásico de los sistemas de rotación 3D simple). El yoke, el cabezal, el beam: cada uno rota en su eje correcto, exactamente como lo hace el fixture físico. El rango de pan es ±135°, el de tilt ±67.5° — los rangos estándar de los movers profesionales.

El **beam cone cambia con el zoom** — si un fixture tiene el zoom abierto, el cono es ancho. Si está cerrado, es un sable láser. El DMX del canal de zoom se refleja visualmente en tiempo real. Sabes de un vistazo qué fixtures están haciendo qué.

El **Bloom HDR** hace que los fixtures encendidos brillen como brillan en la realidad — con esa aureola de luz que el ojo percibe cuando mira directamente a una fuente intensa. No es efectismo: es la diferencia visual entre "fixture encendido" y "fixture apagado" que un render plano no puede transmitir.

La **actualización es a 60fps**, leyendo el estado del DMX directamente en cada fotograma — sin pasar por el ciclo de render de la interfaz gráfica, que en condiciones de carga va más lento. Lo que ves siempre es el estado más fresco posible.

---

## TheProgrammer — el panel de control en directo

Hyperion no es solo para mirar. Es donde tomas el mando cuando lo necesitas.

**TheProgrammer** es el panel de control manual integrado en el LiveStage. Sin cambiar de pantalla, sin abrir otra ventana. Seleccionas uno o varios fixtures en el visualizador, y TheProgrammer aparece con control directo sobre todos ellos.

### Lo que controlas:

**Intensidad** — fader de dimmer con presets rápidos. Un clic a Full, a Half, a Zero. O arrastra al porcentaje exacto que necesitas.

**Posición** — aquí es donde la UX hace la diferencia:

- Con **un solo fixture** seleccionado: XY Pad individual, modo Sniper. Mueves el pad, el fixture te sigue con precisión milimétrica.
- Con **varios fixtures** seleccionados: RadarXY con Fan Control. Un pad central que mueve toda la formación. El ángulo de apertura entre fixtures es configurable.

Y encima de eso, tres **patrones automáticos de movimiento** que puedes activar con un clic:
- **Circle** — todos los fixtures orbitan en círculo con desfase entre ellos
- **Figure Eight** — el infinito, el movimiento más hipnótico del repertorio
- **Sweep** — barrido de lado a lado, coordinated o en ola

La velocidad y amplitud de los patrones se ajustan con sliders en tiempo real — **sin reiniciar el patrón**. La fase continúa exactamente donde estaba. No hay salto, no hay glitch.

**Color** — picker de color directo más botones de acceso rápido a colores de uso frecuente.

**Beam** — zoom, focus, gobo, prism. Los canales que definen la forma de la luz.

**Canales extra (Phantom Panel)** — para fixtures con canales especiales no estándar (rotación, macro, frost, efectos custom), hay un panel de acceso directo. LuxSync los pasa tal cual al DMX sin transformación.

---

## La convivencia inteligente — IA + Manual al mismo tiempo

Este es el punto donde LuxSync hace algo que ningún sistema del mercado hace de la misma manera.

Cuando tú tomas control manual de un fixture, **Selene IA no muere**. Sigue corriendo, sigue analizando el audio, sigue tomando decisiones — pero respeta lo que tú has tocado.

La jerarquía es clara y absoluta:

| Capa | Quién manda | Comportamiento |
|---|---|---|
| 🔴 **Blackout** | Siempre gana | Nuclear. Todos a cero. Los movers se congelan donde están. |
| ✋ **Manual** | Tú | Prioridad absoluta sobre cualquier IA. Lo que tú tocas, se queda. |
| ⚡ **Efectos** | Strobe, flash, blinder | Temporales, se auto-expiran solos. |
| 🧠 **Selene IA** | Automatismo | Opera en todo lo que tú no has tocado. |

Si tomas el dimmer de tres fixtures a mano, Selene sigue moviendo y coloreando esos mismos fixtures — pero no toca el dimmer. Si luego "sueltas" esos fixtures, vuelven a la IA con un **crossfade suave de 500ms con easing cúbico**, no con un salto brusco.

El botón de **UNLOCK ALL** libera todo de golpe cuando lo necesitas. Los patrones activos siguen corriendo — están ahí si quieres volver a ellos.

---

## El blackout profesional

Parece una feature pequeña. En un show en directo, es de las más importantes.

Cuando activas el blackout en LuxSync, los moving heads **se congelan exactamente donde están**. No se van al centro. No hacen el whip vergonzoso que delata los sistemas baratos o mal configurados. Se quedan inmóviles, en su última posición, esperando a que el blackout termine.

Esto tiene un nombre en la industria: **Ghost Protocol**. Es el comportamiento correcto. Es lo que hace cualquier consola profesional. Y LuxSync lo hace.

---

## Grand Master

Un fader global que multiplica la intensidad de todos los fixtures simultáneamente. Baja el Grand Master a cero: blackout suave de todo el rig. Súbelo: todo vuelve al nivel que tenía.

El control más básico y más importante de cualquier consola de iluminación. Aquí está, en TheProgrammer.

---

## Modos de operación — elige el tuyo

LuxSync no te impone un modo de trabajo. Los combinas como necesitas:

**Modo completamente automático** — Selene IA lleva todo el show. Tú pinchas, ella ilumina. Cero intervención.

**Modo completamente manual** — TheProgrammer al mando. Selene IA en standby. Tú decides cada cambio.

**Modo híbrido** — el más poderoso. Selene lleva la base, tú intervenes en momentos clave. Bajas el dimmer de los pars mientras sube la energía del drop. Cambias el color de un grupo para destacar una sección. Y cuando sueltas, la IA retoma suavemente lo que tú dejaste.

**Modo Chronos** — el timeline programado de tu show corre, y Selene IA sigue activa pero con las sugerencias del timeline como contexto. La IA reactiva dentro de una estructura pre-diseñada. Lo mejor de los dos mundos.

---

## Honestidad: lo que Hyperion no tiene (todavía)

Siguiendo con la misma política de siempre:

**Sin simulación de haze o niebla.** Los beams en 3D son conos geométricos, no luz volumétrica en niebla. Para ver los rayos en el aire como en un escenario real necesitas esa simulación, y es computacionalmente muy costosa. No está en v1.

**Sin visualización de gobo.** Los patrones de gobo no se proyectan en el suelo ni en las superficies del visualizador 3D. Los ves activos en el canal DMX pero no en el render visual. Está en el roadmap.

**Sin integración MIDI** en TheProgrammer todavía. El control manual es por ratón/touchpad en esta versión. La arquitectura está preparada para MIDI pero no está implementado en la beta.

---

## ¿Para quién es Hyperion?

**Para el DJ que actúa solo** y quiere ver en todo momento qué están haciendo sus luces sin mirar al techo. El LiveStage 3D te lo dice.

**Para el técnico que mezcla manual e IA** y necesita un panel de control rápido, sin fricciones, que no le haga perder el hilo del show mientras toma decisiones en décimas de segundo.

**Para la sala que programa shows** y quiere visualizar el resultado antes de llegar al venue. Diseñas en el software, ves exactamente lo que va a pasar, llegas al escenario sin sorpresas.

**Para quien trabaja solo**, en un portátil, gestionando toda la iluminación de la noche desde una sola pantalla. Hyperion es esa pantalla.

---

## Incluido en LuxSync Suite

Hyperion y TheProgrammer forman parte de la suite completa. No son módulos separados. El LiveStage lee en tiempo real lo que decide Selene IA, lo que programa Chronos, y lo que tú controlas manualmente — todo en la misma ventana, al mismo tiempo.

La suite completa, disponible ahora en beta a través de **MG Music & Light**.

**[→ Descarga en mgmusicandlight.com]**

---

*LuxSync — Developed by GestIAdev*  
*"Cuando la señal sale de aquí, sale limpia."*
