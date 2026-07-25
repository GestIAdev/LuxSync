Informe Forense: Interacción Arquetipo → Métricas de Contexto → Disparos
Cadena de datos


DnaRail (UI)
  → LfxClipInstance.bakeCognitiveDNA()     [aplica bias del archetype]
  → LfxClipInstance.toCognitiveDNA()       [deriva textureAffinity + pressureRange del archetype]
  → CognitiveDNA (guardado en .lfx)
  → DynamicEffectRegistry.registerEffectV3()  [extrae campos planos a RegistryEntry]
  → EffectDreamSimulator.filterByZone()    [filtra por aggression vs zona musical actual]
  → EffectDreamSimulator.filterByPressure() [filtra por pressureRange vs rawEnergy actual]
  → EffectDreamSimulator.calculateTextureBonus() [bonus/penalty por textureAffinity vs spectral]
  → SeleneTitanConscious                   [pressure veto + heavy/divine abort]
Hallazgos
1. energyZone del CognitiveDNA — MUERTO en runtime
El CognitiveDNA.energyZone (ej: {min:'intense', max:'peak'}) se guarda en RegistryEntry.energyZone pero nunca se consulta para filtrar en runtime:

EffectDreamSimulator.filterByZone() (@EffectDreamSimulator.ts:575) filtra por aggression del efecto vs zona musical actual, no por el energyZone declarado en el DNA.
HuntEngine.getEligibleCandidates() (@HuntEngine.ts:66) recibe energyZone como parámetro pero lo ignora — solo hace fallback divine→heavy→all-vibe.
SeleneTitanConscious (@SeleneTitanConscious.ts:646) aborta heavy effects en silence/valley usando ars.zone.label (zona musical actual), no el energyZone del efecto.
Consecuencia: Un efecto declarado para peak puede disparar en ambient si su aggression pasa el filtro (≥0 y ≤0.70). Y un efecto declarado para ambient puede disparar en peak si su aggression es ≥0.70. El energyZone del DNA es decorativo.

2. pressureRange — Auto-derivado del archetype, persiste aunque el archetype cambie
toCognitiveDNA() (@LfxClipInstance.ts:561-577) deriva pressureRange del archetype:

Archetype	pressureRange derivado
strobe/heavy/divine	{min:0.5, max:1.0}
ambient	{min:0.0, max:0.5}
utility	{min:0.0, max:1.0}
Este rango se guarda en el .lfx y se registra en RegistryEntry.pressureRange. En runtime:

filterByPressure() (@EffectDreamSimulator.ts:621) filtra candidatos cuya presión acústica actual (rawEnergy) no cae en el rango.
SeleneTitanConscious (@SeleneTitanConscious.ts:702-710) aplica un hard veto si rawEnergy está fuera del rango.
Problema: Si el usuario cambia el archetype de strobe a ambient en DnaRail, pero el efecto ya tenía pressureRange={0.5,1.0} guardado de antes, el override del usuario (form.pressureRange) tiene prioridad (WAVE 7176). Pero si el usuario no editó los sliders de presión manualmente, toCognitiveDNA() recalcula del archetype actual. Aquí no hay bug — el problema es si el .lfx se guardó con un archetype y luego se re-abrió con otro distinto sin re-bakear.

3. textureAffinity — Auto-derivado del archetype, override manual funciona
toCognitiveDNA() (@LfxClipInstance.ts:539-544) deriva textureAffinity del archetype:

Archetype	textureAffinity
strobe/heavy	dirty
ambient/divine	clean
utility	universal
En runtime, calculateTextureBonus() (@EffectDreamSimulator.ts:1412) aplica un bonus/penalty suave (-0.03 a +0.08) basado en la coincidencia entre la textureAffinity del efecto y la textura espectral real del audio. No es un gate — solo afecta el score de ranking.

Problema potencial: Si el archetype fuerza dirty pero el efecto es visualmente limpio (ej: un strobe blanco suave), el penalty de -0.03 en entornos limpios puede hacer que pierda contra otros efectos. Pero no fuerza disparos — solo afecta el ranking.

4. aggression clamps del archetype — FUERZA disparos innecesarios
Este es el hallazgo más grave. bakeCognitiveDNA() (@LfxClipInstance.ts:411) aplica clamps duros al genome:

Archetype	aggressionMin	aggressionMax
divine	0.90	—
strobe	0.75	—
heavy	0.70	—
ambient	—	0.30
utility	—	—
Estos clamps se aplican al acoTriad.aggression que luego se guarda como genome.aggression en el CognitiveDNA. En runtime, filterByZone() (@EffectDreamSimulator.ts:575) usa entry.dna.aggression para filtrar:



typescript
// filterByZone usa aggression del RegistryEntry:
return entry.dna.aggression >= limits.min && entry.dna.aggression <= limits.max
Cadena problemática:

Usuario selecciona archetype divine → bakeCognitiveDNA() fuerza aggression ≥ 0.90
Se guarda el .lfx con genome.aggression = 0.90
En runtime, filterByZone('active') tiene límites {min:0.40, max:0.80}
El efecto con aggression 0.90 NO pasa el filtro de zona 'active' (0.90 > 0.80)
Pero si Cassandra predice un drop → projectedZone = 'peak' → límites {min:0.70, max:1.00} → pasa
El efecto dispara en el drop, pero también dispara en buildup si projectedZone = 'intense' (min:0.60, max:1.00)
El archetype fuerza aggression alta → el efecto solo puede disparar en zonas altas → pero el efecto puede disparar en cualquier zona alta sin distinguir si la energía real la justifica.

5. RegistryEntry no tiene campo archetype
El archetype que acabamos de añadir a CognitiveDNA (WAVE 7177) se pierde al registrar el efecto. _buildEntryFromV3() (@DynamicEffectRegistry.ts:410) no lo extrae. Esto significa que el runtime no puede saber qué archetype tenía un efecto — solo ve los valores derivados (aggression, pressureRange, textureAffinity).

6. Fallback relajado en filterByZone y filterByPressure
Ambos filtros tienen un fallback que devuelve todos los efectos si el filtro es demasiado estricto:

filterByZone() (@EffectDreamSimulator.ts:602): si nadie pasa, devuelve los 3 más suaves
filterByPressure() (@EffectDreamSimulator.ts:636): si nadie pasa, devuelve todos sin filtrar
Esto significa que los gates son "soft" — si el archetype fuerza valores extremos que nadie pasa, el sistema relaja y dispara de todos modos.

Resumen de la cadena causal


Archetype 'divine'
  → bake: aggression = 0.90 (clamp duro)
  → toCognitiveDNA: pressureRange = {0.5, 1.0} (requiere alta energía)
  → toCognitiveDNA: textureAffinity = 'clean'
  → Registry: aggression=0.90, pressure={0.5,1.0}, texture=clean
  → filterByZone: solo pasa en 'intense'/'peak' (aggression > 0.80)
  → filterByPressure: solo pasa si rawEnergy ≥ 0.5
  → SeleneTitanConscious: heavy abort si zona=silence/valley, divine abort si epicness < 0.60
  → DISPARA cuando: zona=intense/peak AND rawEnergy≥0.5 AND epicness≥0.60
El arquetipo no fuerza disparos directos, pero restringe tanto el espacio de validez que cuando el efecto pasa todos los gates, es porque la energía está alta — y entonces dispara. El problema es que el efecto no debería disparar solo porque la energía esté alta si la música no lo justifica rítmicamente.

Puntos de intervención potenciales
Hacer que filterByZone() consulte entry.energyZone además de entry.dna.aggression — un efecto declarado para peak no debería disparar en active aunque su aggression sea 0.75.
Propagar archetype al RegistryEntry para que el runtime pueda aplicar lógica específica por archetype.
Hacer que los clamps del archetype sean soft (sugeridos) en lugar de hard (forzados) — o al menos que el usuario pueda desactivarlos en Expert Mode.
Revisar el fallback relajado de filterByZone y filterByPressure — si nadie pasa, quizás no debería disparar nada en lugar de relajar.