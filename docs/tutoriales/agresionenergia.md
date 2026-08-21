La aggression del DNA es el filtro primario que decide qué efectos entran en cada zona energética. Así funciona:

El mapeo Aggression → Zona


Zona        Aggression range    Tipo de efecto
────────    ────────────────    ──────────────────────────
silence     0.00 - 0.35         Efectos muy suaves (DigitalRain)
valley      0.00 - 0.50         Suaves + respiración
ambient     0.00 - 0.70         Moderados (Amazon Mist, Ghost Breath)
gentle      0.00 - 0.85         Transición amplia (Corazon Latino, latin_bubbles)
active      0.35 - 0.80         Medios (Ambient Strobe, binary_glitch)
intense     0.60 - 1.00         Hard (Solar Flare, Salsa Fire, Strobe Storm)
peak        0.70 - 1.00         Los más brutales (Gatling, core_meltdown)
Cómo influye en la simulación
El flujo es:

Oracle predice zona → energyZone (basada en energía actual) o projectedZone (basada en predicción)
filterByZone filtra efectos: solo pasan los que tienen aggression dentro del rango de esa zona
filterByPressure filtra por presión acústica (el segundo filtro)
Ejemplo con tus efectos:

Efecto	Aggression	Zonas donde entra
Corazon Latino	~0.38	silence, valley, ambient, gentle, active
latin_bubbles	~0.45	valley, ambient, gentle, active
Amazon Mist	~0.55	ambient, gentle, active, intense
Solar Flare	~0.88	intense, peak
Strobe Storm	~0.95	intense, peak
Por qué Corazon Latino y latin_bubbles coincidieron
Cuando el Oracle overrideó a gentle (rango 0.00-0.85), ambos pasaron:

Corazon Latino (0.38) → dentro de 0.00-0.85 ✅
latin_bubbles (0.45) → dentro de 0.00-0.85 ✅
Y cuando overrideó a ambient (rango 0.00-0.70), pasaron los más suaves:

Amazon Mist (0.55) → dentro de 0.00-0.70 ✅
Corazon Latino (0.38) → dentro de 0.00-0.70 ✅
Pero Solar Flare (0.88) → fuera de 0.00-0.70 ❌
El detalle clave: rangos solapados
Las zonas se solapan intencionalmente. gentle va de 0.00 a 0.85, así que incluye efectos ambientales Y algunos active. Esto permite que en una transición suave haya variedad. Si los rangos fueran disjuntos (gentle 0.50-0.70, active 0.70-0.85), habría huecos donde ningún efecto calzaría.

El solapamiento es lo que permite que latin_bubbles (active) y Corazon Latino (gentle) compartan ranking en zona gentle — ambos caen en el rango 0.00-0.85.