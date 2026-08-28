WAVE 7644-16BIT-DIMMER — Phase 1: Ingestion Unlock
Changes Applied (6 files, 0 type errors)
1. oflTranslator.ts — OFL fine alias mapping

Added else if (parentType === 'dimmer') fineType = 'dimmer_fine' at line 275
OFL fixtures with dimmer fineChannelAliases now produce a dimmer_fine channel type instead of a duplicate dimmer
2. types/FixtureDefinition.ts — Canonical ChannelType union

Added | 'dimmer_fine' to the ChannelType union (line 11)
This is the source-of-truth type imported by oflTranslator.ts
3. aether/types.ts — AetherChannelType union

Added | 'dimmer_fine' (line 135)
Allows the ingestion pipeline to cast normalized channel types to AetherChannelType without error
4. NodeExtractionPipeline.ts — Pairing logic + priority

Added _pairDimmerFine() helper method (line 1279): detects dimmer_fine channels at dmxOffset N, finds the coarse dimmer at N-1, upgrades it to is16bit: true via spread copy (respects readonly), and filters out the absorbed fine channel
Wired into _mapChannels() (line 1363): return this._pairDimmerFine(mappedChannels)
Wired into _mapForgeNodes() (line 713): return this._pairDimmerFine(mappedNodes)
Added dimmer_fine: 79 to CHANNEL_PRIORITY_BY_TYPE (line 227)
5. HephUtils.ts — Hephaestus 16-bit params

Added 'dimmer' to DMX_16BIT_PARAMS set (line 55)
scaleToDMX16() now processes dimmer, emitting { coarse, fine } pair
6. cellTypeAdmittance.ts + FixtureFactory.ts — Exhaustive records

Added dimmer_fine entries to CELL_TYPE_ADMITTANCE and getChannelTypes()/getChannelLabel() to satisfy Record<ChannelType, ...> exhaustiveness requirements
How the pairing works


Fixture profile (OFL):
  CH1: dimmer (coarse)     ← fineChannelAliases: ["Dimmer Fine"]
  CH2: Dimmer Fine (alias) ← resolved as dimmer_fine by oflTranslator
 
After _pairDimmerFine():
  Node channels: [{ type: 'dimmer', dmxOffset: 0, is16bit: true }]
  ↑ dimmer_fine at offset 1 absorbed; dimmer upgraded to 16-bit
 
NodeResolver writes:
  buf[0] = coarse (MSB) = (raw16 >> 8) & 0xFF
  buf[1] = fine   (LSB) = raw16 & 0xFF
This mirrors exactly how pan/pan_fine and tilt/tilt_fine already work. The NodeResolver's generic 16-bit path at line 1411-1422 handles the rest — it's channel-type agnostic and only checks chDef.is16bit.