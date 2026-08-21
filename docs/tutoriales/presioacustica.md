La presión acústica: el segundo filtro
Cada efecto tiene un pressureRange en su .lfx que define su envolvente de presión acústica — el rango de energía donde el efecto "tiene sentido" visualmente.

pressureRange de tus efectos latin
Efecto	Aggression	pressureRange	Significado
Corazon Latino	0.38	0.00 - 0.58	Solo presión baja (gentle/valley)
Cumbia Moon	~0.40	0.09 - 0.60	Presión baja-media
Solar Flare	0.88	0.00 - 0.61	Sorprendente: presión baja (es visual suave)
Amazon Mist	0.55	0.00 - 1.00	Universal (cualquier presión)
Ghost Breath	~0.45	0.00 - 1.00	Universal
Tidal Wave	~0.60	0.00 - 1.00	Universal
Kitt Scanner	~0.70	0.50 - 1.00	Solo presión alta
Latina Meltdown	0.95	0.75 - 1.00	Solo climax brutal
Salsa Fire	0.90	0.90 - 1.00	Solo el pico del pico
Divine Obliteration	~0.95	0.50 - 1.00	Presión alta
Cómo funciona el filtro doble


Candidato pasa si:
  1. aggression está en el rango de la zona (filterByZone)
  2. presión actual está dentro de pressureRange (filterByPressure)
Ejemplo con presión actual = 0.95 (climax):

Efecto	¿Pasa zona?	pressureRange	¿Pasa presión?	Resultado
Corazon Latino	gentle ✅	0.00-0.58	0.95 > 0.58 ❌	Filtrado
Amazon Mist	ambient ✅	0.00-1.00	0.95 ≤ 1.00 ✅	Pasa
Salsa Fire	intense ✅	0.90-1.00	0.95 ≤ 1.00 ✅	Pasa
El caso de Corazon Latino
Corazon Latino tiene pressureRange: 0.00-0.58. En un climax (presión 0.95), no pasa el filtro de presión aunque la zona sea gentle. Por eso necesitábamos el relaxGuardsForFuture — perdona que 0.95 > 0.58 cuando viene un breakdown.

Sin relajación:

Zona gentle ✅ (aggression 0.38 en rango 0.00-0.85)
Presión 0.95 > 0.58 ❌ → filtrado
Con relajación (WAVE 7560):

Zona gentle ✅
Presión 0.95 > 0.58 pero relaxGuardsForFuture perdona el MAX → pasa
El caso de Solar Flare
Solar Flare es interesante: aggression 0.88 (intense/peak) pero pressureRange: 0.00-0.61. Es un efecto visualmente intenso pero que solo tiene sentido con presión baja. En un climax (0.95), no pasa el filtro de presión. Por eso lo veías ganar en zona gentle con presión baja pero no en climax.

Casos especiales
pressureRange: {0, 0} — es permissive, el efecto pasa siempre (no se filtra por presión). Pero en tus efectos latin, nadie usa {0, 0}. Los que tienen {0, 1} son universales (Amazon Mist, Ghost Breath, Tidal Wave).

Resumen del filtro doble


Pool inicial (17 efectos vibe-latina)
  │
  ├─ filterByZone (aggression vs zona)     → elimina los que no calzan por agresión
  │    └─ fallback: si <4, trae adyacentes
  │
  ├─ filterByPressure (presión vs range)   → elimina los que no calzan por presión
  │    └─ relaxGuardsForFuture: perdona MAX si viene breakdown
  │
  └─ Ranking (DNA, diversity, vibe, risk)  → ordena los sobrevivientes
Los dos filtros son independientes pero secuenciales. Un efecto puede pasar la zona y caer en la presión, o viceversa. El que gana el ranking es el que sobrevive ambos Y tiene mejor score.