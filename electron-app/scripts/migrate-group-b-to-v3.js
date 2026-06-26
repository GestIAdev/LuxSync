/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔄 CIRUGÍA GRUPO B → V3 — Migración quirúrgica de .lfx legacy V2.1 a V3.0
 *
 * SEGURO DE GATILLO DOBLE: Omite cualquier archivo con $schema "luxsync.lfx/3.0"
 * o con clip.tracks como Array. Los V3 nativos son INTOCABLES.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LFX_DIR = path.resolve(__dirname, '../src/core/arsenal/builtins');

function migrateSurgical() {
  const files = [];
  function scanDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.lfx')) {
        files.push(fullPath);
      }
    }
  }
  scanDir(LFX_DIR);

  let migratedCount = 0;
  let skippedCount = 0;
  let warningCount = 0;

  for (const filePath of files) {
    const fileName = path.relative(LFX_DIR, filePath);
    const rawData = fs.readFileSync(filePath, 'utf-8');
    let json;
    try {
      json = JSON.parse(rawData);
    } catch {
      console.warn(`[OMITIDO] ⚠️ "${fileName}" no es JSON válido.`);
      warningCount++;
      continue;
    }

    // 🔒 SEGURO DE GATILLO DOBLE (Protección total para nativos V3)
    if (json.$schema === 'luxsync.lfx/3.0' || Array.isArray(json.clip?.tracks)) {
      console.log(`[INTOCABLE] 🛡️ Saltando "${fileName}" (Ya es V3 nativo).`);
      skippedCount++;
      continue;
    }

    const clip = json.clip;
    if (!clip || !clip.curves) {
      console.warn(`[OMITIDO] ⚠️ "${fileName}" no tiene formato reconocido (sin clip.curves).`);
      warningCount++;
      continue;
    }

    console.log(`[MIGRANDO] 🔧 Transmutando legacy V2.1: "${fileName}"...`);

    // 1. Extraer zonas heredadas del V2
    const legacyZones = clip.zones || ['all'];

    // 2. Convertir diccionario clip.curves -> Array clip.tracks
    const tracks = Object.values(clip.curves).map((curve) => ({
      id: crypto.randomUUID(),
      paramId: curve.paramId,
      zones: [...legacyZones],
      blendMode: 'replace',
      curve: {
        paramId: curve.paramId,
        valueType: curve.valueType,
        range: curve.range,
        defaultValue: curve.defaultValue,
        keyframes: curve.keyframes,
        mode: curve.mode || 'absolute',
      },
    }));

    // 3. Ensamblar estructura limpia V3
    const v3Payload = {
      $schema: 'luxsync.lfx/3.0',
      clip: {
        id: clip.id,
        name: clip.name,
        author: clip.author || 'LuxSync Factory Migrator',
        category: clip.category || 'physical',
        tags: clip.tags || [],
        vibeCompat: clip.vibeCompat || [],
        spatialZones: legacyZones,
        mixBus: clip.mixBus || 'htp',
        priority: clip.priority ?? 65,
        durationMs: clip.durationMs,
        effectType: clip.effectType || 'heph_custom',
        tracks,
        staticParams: clip.staticParams || {},
        cognitiveDNA: clip.cognitiveDNA,
        simulationMeta: clip.simulationMeta,
      },
    };

    fs.writeFileSync(filePath, JSON.stringify(v3Payload, null, 2) + '\n', 'utf-8');
    migratedCount++;
  }

  console.log(`\n🎉 CIRUGÍA TERMINADA:`);
  console.log(`- Protegidos (V3 intocables): ${skippedCount}`);
  console.log(`- Transmutados a V3: ${migratedCount}`);
  console.log(`- Omitidos (formato no reconocido): ${warningCount}`);
  console.log(`- Total escaneados: ${files.length}`);
}

migrateSurgical();
