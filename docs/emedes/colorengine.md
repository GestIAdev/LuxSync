Reporte: Sistema Cromático de Chill-Lounge
1. Cuántos colores genera SeleneColorEngine
SeleneColorEngine genera 5 colores HSL (no 4):

Color	Rol	Destino típico
primary	Protagonista	PARs front, wash general
secondary	Complemento	Back PARs, Fibonacci rotation, movers L
accent	Highlight	Moving heads, beams, back zones
ambient	Relleno suave	Fills, backlighting, zona ambient
contrast	Siluetas/sombras	Se pierde en la conversión
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/SeleneColorEngine.ts:46-59 define SelenePalette con 5 colores.

Sin embargo, selenePaletteToColorPalette() en @/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/ColorProcessors.ts:86 convierte a ColorPalette que solo tiene 4 (primary, secondary, accent, ambient). El 5º color contrast se descarta en la conversión.

@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/protocol/LightingIntent.ts:35-46 confirma: ColorPalette tiene 4 slots.

2. ColorConstitution — Cómo controla los límites
CHILL_CONSTITUTION en @/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/colorConstitutions.ts:380-440 es la constitución activa para chill-lounge. Es hardcodeada como un objeto GenerationOptions:

forceStrategy: 'analogous' — inmutable, el StrategyArbiter no puede overridearlo
forbiddenHueRanges: [[330,360], [0,180]] — prohíbe todo el espectro cálido + verde
allowedHueRanges: [[180,260], [290,320]] — solo Cian→Azul→Índigo + Magenta
saturationRange: [50,85], lightnessRange: [30,60]
atmosphericTemp: 8500 (gravedad térmica oceánica)
TitanEngine la consulta en @/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/TitanEngine.ts:758 vía getColorConstitution(vibeProfile.id) y la pasa al SeleneColorEngine.generate() como options.

3. La paleta de chill-lounge — Hardcodeada
Sí, está hardcodeada en dos niveles que entran en conflicto:

Nivel A: VibeProfile (ChillLoungeProfile.ts)
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/vibe/profiles/ChillLoungeProfile.ts:32-56 define:

forbiddenHueRanges: [[180, 270]] — prohíbe azul/cian
allowedHueRanges: [[0, 60], [300, 360]] — solo naranjas, rojos, ámbar, magenta
atmosphericTemp: 2800 — cálido (velas)
Comentario dice: "Colores cálidos y suaves"
Nivel B: ColorConstitution (colorConstitutions.ts)
@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/color/colorConstitutions.ts:380-440 define:

forbiddenHueRanges: [[330,360], [0,180]] — prohíbe rojos, naranjas, verdes
allowedHueRanges: [[180,260], [290,320]] — solo cian, azul, índigo, magenta
atmosphericTemp: 8500 — frío oceánico
Contradicción total: El VibeProfile dice "cálido, naranjas, sin azules". La Constitución dice "frío, azules, sin naranjas". En la práctica, la Constitución gana porque TitanEngine.ts:758 la pasa directamente a SeleneColorEngine.generate() como options, y el engine aplica forbiddenHueRanges + allowedHueRanges + atmosphericTemp de la constitución. El VibeProfile se usa solo para VibeManager.constrainColor() (validación post-hoc) que raramente se invoca en el hot path.

4. Cómo llega la paleta a las zonas
El enrutamiento color→zona está en @/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/TitanEngine.ts:924-955:

Zona	paletteRole	Color de la paleta
frontL / frontR	primary	Color protagonista
backL / backR	accent	Color de acento
left (movers)	secondary	Color secundario
right (movers)	ambient	Color ambiente
front (legacy)	primary	Color protagonista
back (legacy)	accent	Color de acento
ambient	ambient	Color ambiente
El enrutamiento es estático y hardcodeado — no hay lógica que asigne colores diferentes según el vibe. Chill-lounge usa el mismo mapeo que techno-club.

5. El problema: la paleta NO llega a todas las zonas con variedad
Sí, la paleta llega a todas las zonas (front, back, left, right, ambient, frontL/R, backL/R), pero:

Solo 4 de 5 colores se usan (contrast se descarta)
El mapeo es fijo — front siempre gets primary, back siempre gets accent, sin variación por vibe
El ChillAmbientEngine (@/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hal/physics/ChillAmbientEngine.ts:158-203) no enruta color — solo controla intensidad zonal (frontL/R, backL/R) y posición de movers. El color viene exclusivamente de SeleneColorEngine vía TitanEngine
El clip boreal_ocean.lfx que creamos tiene su propia curva de color con blendMode: "replace" que sobreescribe el color de Selene en las fixtures que toca. Esto significa que cuando el clip está activo, el color de Selene no llega a esas fixtures
Resumen del estado actual
5 colores generados, 4 usados (contrast perdido)
Paleta hardcodeada en CHILL_CONSTITUTION (azul/magenta oceánico) — contradice al ChillLoungeProfile (cálido/naranja)
Enrutamiento zona→color estático en TitanEngine, mismo para todos los vibes
ChillAmbientEngine controla intensidad zonal pero no color
Boreal Ocean .lfx sobreescribe color via blendMode: "replace" — puede entrar en conflicto con Selene
¿Quieres que alinee el ChillLoungeProfile con la CHILL_CONSTITUTION para resolver la contradicción, o que haga que el enrutamiento color→zona sea vibe-aware?