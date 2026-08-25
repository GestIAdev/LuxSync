Voy a recopilar todos los datos reales del código ahora mismo:

Ahora tengo toda la información. Aquí está el reporte:

---

# REPORTE ARQUITECTÓNICO: Estado Actual del Sistema de Fixtures
## Para el Arquitecto — Unificación Pendiente

### 1. MAPA DE CARPETAS FÍSICAS (lo que existe en disco)

#### Desarrollo (ahora mismo en tu PC)

```
LuxSync/                                    ← PROJECT ROOT
├── librerias/                              ← LIBRERÍA FACTORY (16 archivos)
│   ├── 5R Beamer Stream.fxt               ← .fxt (formato propietario)
│   ├── beam 2r.fxt
│   ├── beam led 2r.fxt
│   ├── BeukyStrobe148.fxt
│   ├── LB230N.fxt
│   ├── Neo 250 .fxt
│   ├── par tec flat .fxt
│   ├── Quantum Pro LED Wash.fxt
│   ├── Vizi Spot LED Pro ground.fxt
│   ├── EL_1140.json                        ← .json (formato nuevo)
│   ├── foco_chino_temu.json
│   ├── foco_temu.json
│   └── barato.json
│
├── fixtures/                               ← USER FIXTURES (project root, dev only)
│   ├── user-1770473024494-gooaf830g.json
│   ├── user-1776551819488-ul7dn8822.json   ← "7 grande" (la que desapareció)
│   └── ... (4 archivos user-*.json)
│
└── electron-app/                           ← CÓDIGO FUENTE
    ├── librerias/                          ← ¡BASURA! (1 archivo: barato.json duplicado)
    ├── dist-electron/main.js               ← Código compilado que se ejecuta
    └── package.json                        ← extraResources: { from: "../librerias" }

C:\Users\Raulacate\AppData\Roaming\luxsync-electron\  ← USERDATA (persistente)
├── fixtures/                               ← USER FIXTURES (copia de trabajo)
│   ├── user-1770473024494-gooaf830g.json  ← (11 archivos, copiados del project root)
│   ├── user-1776551819488-ul7dn8822.json
│   ├── ...
│   ├── factory/                            ← COPIA DE FACTORY (seeding, 16 archivos)
│   │   ├── 5R Beamer Stream.fxt
│   │   └── ...
│   └── custom/                             ← ¡LEGACY! (4 archivos, ya no se usa)
│       └── ...
└── ...
```

#### Producción (app empaquetada instalada)

```
C:\Program Files\LuxSync\                   ← INSTALL DIR
├── resources\
│   ├── librerias\                          ← FACTORY (extraResources, 16 archivos)
│   │   ├── 5R Beamer Stream.fxt
│   │   └── ...
│   ├── app.asar                            ← Código empaquetado (no escaneable)
│   └── builtins\                           ← Arsenal de efectos
│
C:\Users\Raulacate\AppData\Roaming\luxsync-electron\  ← USERDATA (persistente)
├── fixtures\                               ← USER FIXTURES
│   ├── user-*.json                         ← (los que el usuario cree/guarde)
│   ├── factory\                            ← COPIA DE FACTORY (seeding first boot)
│   │   └── ...
│   └── custom\                             ← ¡LEGACY! (vacío o residual)
└── ...
```

---

### 2. TABLA DE RUTAS — Quién lee qué y de dónde

| Variable | Dev | Prod | Notas |
|----------|-----|------|-------|
| `factoryLibPath` | `LuxSync/librerias/` | `resources/librerias/` | Pathfinder: 3 candidatos en dev, 1 en prod |
| `customLibPath` | `userData/fixtures/` | `userData/fixtures/` | Igual en ambos — **ESTO ESTÁ BIEN** |
| `factoryUserDataPath` | `userData/fixtures/factory/` | `userData/fixtures/factory/` | Copia de seeding (writable) |
| `projectRootFixturesPath` | `LuxSync/fixtures/` | **NO EXISTE** | Solo dev — seeding a userData |

---

### 3. FLUJO DE LECTURA (`lux:library:list-all`)

```
IPC handler llama a scanFixtureFolderRecursive() DOS veces en paralelo:

1. scanFixtureFolderRecursive(factoryLibPath, 'system')
   → Dev: escanea LuxSync/librerias/ (16 archivos .fxt + .json)
   → Prod: escanea resources/librerias/ (16 archivos .fxt + .json)
   → Recorre subcarpetas recursivamente
   → .fxt → fxtParser.parseFile()
   → .json → JSON.parse()
   → Resultado: systemFixtures[]

2. scanFixtureFolderRecursive(customLibPath, 'user')
   → Dev: escanea userData/fixtures/ (11 archivos user-*.json)
   → Prod: escanea userData/fixtures/ (N archivos user-*.json)
   → Recorre subcarpetas recursivamente
   → SALTA subcarpetas "factory/" y "custom/" (legacy)
   → Resultado: userFixtures[]

Return: { systemFixtures, userFixtures, paths }
```

---

### 4. FLUJO DE ESCRITURA (`lux:library:save-user`)

```
1. Recibe fixture payload del frontend (Forge)
2. Genera ID si no tiene: user-{timestamp}-{random}
3. scanFixtureFolderRecursive(customLibPath, 'user')  ← busca si ya existe
4. Si existe → actualiza el mismo archivo (mantiene ruta)
5. Si no existe → crea nuevo en customLibPath/{id}.json
   → Dev: userData/fixtures/{id}.json
   → Prod: userData/fixtures/{id}.json
   → IGUAL EN AMBOS
6. rescanAllLibraries() → refresca cache en memoria
```

---

### 5. FLUJO DE BORRADO (`lux:library:delete-user`)

```
1. scanFixtureFolderRecursive(customLibPath, 'user')  ← busca por ID
2. Si encuentra → fs.unlinkSync(filePath)
3. rescanAllLibraries() → refresca cache
4. Solo puede borrar de userFixtures (system es read-only)
```

---

### 6. FLUJO DE SEEDING (first boot)

```
A) Factory seeding (siempre, dev + prod):
   factoryLibPath → copia a userData/fixtures/factory/
   Propósito: copia writable para que el usuario pueda resetear

B) User seeding (SOLO dev):
   LuxSync/fixtures/user-*.json → copia a userData/fixtures/
   Propósito: sincronizar fixtures del repo con userData en desarrollo
```

---

### 7. PROBLEMAS ARQUITECTÓNICOS IDENTIFICADOS

| # | Problema | Causa Raíz | Impacto |
|---|----------|-----------|---------|
| 1 | **3 ubicaciones físicas para factory** | `LuxSync/librerias/` + `electron-app/librerias/` (basura) + `userData/fixtures/factory/` (copia) | Confusión, duplicados, pathfinder complejo |
| 2 | **2 ubicaciones para user fixtures en dev** | `LuxSync/fixtures/` + `userData/fixtures/` | Seeding innecesario, desync entre repo y userData |
| 3 | **Carpeta `custom/` legacy** | WAVE 7591 creó `fixtures/custom/` pero WAVE 7604c la abandonó | 4 archivos huérfanos que el escaneo salta |
| 4 | **`electron-app/librerias/` con 1 archivo basura** | `barato.json` duplicado del project root | Sombrea la librería real si el pathfinder ordena mal |
| 5 | **Pathfinder con 3 candidatos** | Necesario porque las rutas cambian dev vs prod | Complejidad innecesaria si se unifica |
| 6 | **Formatos duales .fxt + .json** | .fxt es legacy, .json es nuevo | Dos parsers diferentes para lo mismo |
| 7 | **`barato.json` en librerias/ NO es una fixture** | Es un archivo de test/debug colado en la carpeta factory | Aparece como "system fixture" en la librería |

---

### 8. PROPUESTA DE UNIFICACIÓN (para el arquitecto)

**Objetivo**: 1 sola carpeta, 1 sola ruta, 1 solo formato.

```
userData/fixtures/                    ← ÚNICA CARPETA (dev = prod)
├── (archivos sueltos .json)          ← user fixtures (writable)
├── moving-heads/                     ← subcarpetas opcionales del usuario
│   └── beam-2r.json
└── factory/                          ← factory fixtures (read-only, seeding)
    ├── 5R Beamer Stream.json         ← migrar .fxt → .json
    └── ...
```

**Cambios necesarios**:
1. Eliminar `LuxSync/librerias/` → migrar a `LuxSync/fixtures/factory/` (.fxt → .json)
2. Eliminar `electron-app/librerias/` (basura)
3. Eliminar `LuxSync/fixtures/` (user) → mover a `userData/fixtures/` directamente
4. Eliminar subcarpeta `custom/` legacy
5. `extraResources` copia `fixtures/factory/` → `resources/fixtures/factory/`
6. Pathfinder: 1 sola ruta = `userData/fixtures/` (user) + `userData/fixtures/factory/` (system)
7. Migrar `.fxt` → `.json` (1 solo formato)
8. Eliminar `barato.json` de la librería factory

**Resultado**: 1 carpeta, 1 ruta, 1 formato, dev = prod. Sin pathfinder, sin seeding, sin duplicados.