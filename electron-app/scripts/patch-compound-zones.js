const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '..', 'src', 'core', 'arsenal', 'builtins');
const folders = [
  path.join(BASE_DIR, 'techno'),
  path.join(BASE_DIR, 'latin'),
];

let totalModified = 0;
let totalSkipped = 0;
let totalFiles = 0;

folders.forEach(folder => {
  if (!fs.existsSync(folder)) {
    console.log(`⚠️ Carpeta no existe: ${folder}`);
    return;
  }

  const files = fs.readdirSync(folder).filter(f => f.endsWith('.lfx') || f.endsWith('.jlfx'));

  files.forEach(file => {
    const filePath = path.join(folder, file);
    totalFiles++;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.log(`❌ Error parseando ${file}: ${err.message}`);
      return;
    }

    // Solo tocar archivos v3.0 con tracks
    const schema = data.$schema || '';
    const hasTracks = data.clip && Array.isArray(data.clip.tracks);
    const isV3 = schema.includes('luxsync.lfx/3.0') || hasTracks;

    if (!isV3) {
      totalSkipped++;
      return; // v2.1 usa mood zones a nivel clip, no track zones
    }

    let modified = false;

    data.clip.tracks.forEach(track => {
      if (!Array.isArray(track.zones)) return;

      // Si el track afecta a los PARs, le sumamos el Washer (ambient) y el Strobe (flash)
      if (track.zones.includes('all-pars')) {
        if (!track.zones.includes('ambient')) {
          track.zones.push('ambient');
          modified = true;
        }
        if (!track.zones.includes('flash')) {
          track.zones.push('flash');
          modified = true;
        }
      }

      // Si el track afecta a los Movers, le sumamos el Beam central (air)
      if (track.zones.includes('all-movers')) {
        if (!track.zones.includes('air')) {
          track.zones.push('air');
          modified = true;
        }
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`✅ Actualizado: ${path.basename(folder)}/${file}`);
      totalModified++;
    }
  });
});

console.log(`\n📊 Resumen:`);
console.log(`   Archivos procesados: ${totalFiles}`);
console.log(`   Archivos modificados: ${totalModified}`);
console.log(`   Archivos v2.1 omitidos: ${totalSkipped}`);
console.log('\n¡Arsenal actualizado con Compound Zones!');
