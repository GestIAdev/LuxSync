# WAVE 8272-RECON — Obsidian Vault Offline Hash Mismatch

**Tipo:** Auditoría forense (estrictamente lectura y análisis).
**Síntoma:** el validador expulsa al usuario legítimo cuando la aplicación arranca 100% offline.
**Estado:** causa raíz identificada y reproducida sobre la máquina afectada.

---

## 1. El algoritmo actual

`getHardwareId()` vive en `electron-app/electron/license/LicenseValidator.js:108-156`
(compilado a `LicenseValidator.jsc` por `scripts/forge-jsc.cjs` — el .js distribuido es
la plantilla, el bytecode contiene la lógica real).

```
HWID = SHA-256( mac | hostname | cpuModel | platform )
```

La MAC se selecciona así:

1. `os.networkInterfaces()` → mapa `nombre → [direcciones]`.
2. Para cada interfaz no-blacklisted, se toma la MAC de la **primera entrada de
   dirección no-interna** (`addr.internal === false`, `mac !== 00:00:00:00:00:00`).
3. Candidatos ordenados por `ifacePriority` desc (ethernet=2 > wifi=1 > resto=0),
   desempate alfabético por nombre — determinista **mientras el conjunto sea el mismo**.
4. **`if (candidates.length === 0) → mac = 'UNKNOWN_MAC'`** ← el talón de Aquiles.

Gate 1 (`LicenseValidator.js:350`): `license.hardwareId === detectedHwId`. Si la MAC
muta, el hash muta y el usuario es expulsado a la pantalla de activación
(`main.ts:1330-1352`, mensaje "Hardware no autorizado").

## 2. La fuga offline — por qué el hash muta sin internet

`os.networkInterfaces()` no enumera adaptadores físicos; enumera **entradas de
dirección**. En Windows (libuv → `GetAdaptersAddresses`), un adaptador solo
contribuye MAC si tiene al menos una dirección unicast **no-interna**:

- Adaptador **deshabilitado o apagado** (Wi-Fi off, NIC en power-down sin link):
  desaparece del mapa → sin candidato → `UNKNOWN_MAC`.
- Adaptador **con cable desconectado**: comportamiento dependiente del driver —
  puede conservar link-local IPv6 (MAC visible) o devolver lista unicast vacía
  (invisible). **Nondeterminista por diseño.**

### Reproducido en vivo (esta máquina, ASUS laptop con Ryzen 5800H)

`os.networkInterfaces()` online devuelve **un único ancla posible**:

```
Wi-Fi -> 20:d9:06:a3:bc:a0/IPv4
Loopback Pseudo-Interface 1 -> (sin MAC usable)
```

Sin puerto Ethernet. Al apagar Wi-Fi → el conjunto de candidatos queda **vacío** →
`mac = 'UNKNOWN_MAC'` → hash distinto:

```
ONLINE : 0e755bca3719eb3aafe5b8f88cb5b2c7e303f98ee70ad1f84ad1095efecac986
OFFLINE: 63906aa6b250197cdaf053ec748729733c55ed236e07cb7cb02c6e7664273111
```

Gate 1 falla → `TAMPER`-style rejection → pantalla de activación. El usuario
legítimo es expulsado con el error "La licencia no corresponde a este equipo".

## 3. Regresión introducida por el parche V-06

El comentario V-06 (`LicenseValidator.js:69-78`) documenta la intención:
*"La MAC se toma de CUALQUIER dirección no-interna (IPv4 o IPv6), así un adaptador
físico sin lease IPv4 sigue anclando el HWID."*

Es correcto contra el caso USB/RNDIS que arreglaba, pero **sigue requiriendo que
el adaptador tenga al menos una dirección enumerable** — la dependencia no se
eliminó, solo se relajó de IPv4 a "cualquier dirección". Offline total = cero
direcciones = cero candidatos.

## 4. Huecos adyacentes detectados

| Hueco | Detalle |
|---|---|
| Blacklist incompleta | `IFACE_BLACKLIST` (`:80-83`) no cubre `local area connection` (adaptadores virtuales **Wi-Fi Direct** de Windows, MAC randomizada por sesión), `wintun`, `wireguard`, `tailscale`, `zerotier`, `npcap`, `isatap`, `teredo`, `wan miniport`, `docker`/`wsl`. Si uno sobrevive como único candidato offline → MAC efímera gana el sort → hash inestable incluso entre arranques offline. |
| Sin persistencia | El HWID se recalcula en cada boot desde estado de red vivo. No hay fingerprint canónico cacheado. |
| Doble algoritmo en main.ts | El fallback de error (`main.ts:1317`) usa "primer MAC IPv4 no-interna" — algoritmo **distinto** al del validador; el `detectedHwId` mostrado al usuario en modo validator-error no coincide con lo que Gate 1 compararía. |
| `hostname`/`cpuModel`/`platform` | Constantes en esta máquina — no contribuyen a la varianza (verificado). |

## 5. Propuesta arquitectónica — HWID anclado a hardware inmutable

Cambiar la cadena de anclaje: el hash debe derivar de identidad **estática del
hardware**, con la MAC como último recurso, nunca como entrada primaria.

```
HWID = SHA-256( boardUUID | diskSerial | mac física primaria | hostname | cpu | platform )
```

### Capas de anclaje (en orden de prioridad)

1. **Windows — `Win32_ComputerSystemProduct.UUID`** (placa base, asignado por el
   fabricante, inmutable ante estado de red):
   ```
   powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"
   ```
   Verificado en vivo: `DE387CEC-8ECA-11EC-810F-E4A8DFB415C4`. `wmic` está
   deprecado en Win11 — usar CIM/PowerShell vía `execSync` (boot-time, una vez).
   Fallback dentro de la capa: `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`
   (lectura de registro, sin WMI).
2. **MAC física primaria vía WMI, no vía `os.networkInterfaces()`**:
   `Win32_NetworkAdapter WHERE PhysicalAdapter=TRUE AND MACAddress IS NOT NULL`
   enumera NICs físicos **incluyendo media-disconnected** — resuelve el bug sin
   renunciar a la MAC como componente. Ordenar por `AdapterIndex`/`Name` para
   determinismo; excluir PNPDeviceID con `ROOT\`/`SW\` (virtuales).
3. **Disco**: `Win32_DiskDrive.SerialNumber` (o `Get-PhysicalDisk`) del disco
   del sistema — segundo ancla física.
4. macOS: `IOPlatformUUID` vía `ioreg -rd1 -c IOPlatformExpertDevice`.
   Linux: `/etc/machine-id` → `/sys/class/dmi/id/product_uuid`.

### Diseño del validador (fail-graceful, determinista)

```
anchors = []
boardUUID = tryWMI('Win32_ComputerSystemProduct.UUID')        // capa 1
if boardUUID: anchors.push(boardUUID)
physMacs  = tryWMI('Win32_NetworkAdapter physical, sorted')   // capa 2
if physMacs: anchors.push(physMacs[0])
diskSer   = tryWMI('Win32_DiskDrive system serial')           // capa 3
if diskSer: anchors.push(diskSer)
// fallback final: os.networkInterfaces() con la lógica V-06 actual
// (misma blacklist + score) para no regresionar el ancla de licencias ya emitidas
if !anchors: mac = networkInterfacesAnchor()

combined = anchors.join('|') + '|' + hostname + '|' + cpu + '|' + platform
HWID = sha256(combined)
```

Notas:

- **Suficiente ancla**: Gate 1 puede exigir coincidencia del hash completo
  (licencias nuevas ancladas a boardUUID) o, más tolerante, comparar anchors
  individuales y admitir ≥2 coincidencias — la primera opción es la más simple
  y no pierde fuerza: boardUUID nunca cambia.
- **Migración**: las licencias emitidas con la fórmula MAC|host|cpu|platform
  dejarían de validar si el combined cambia. Opciones: (a) incluir ambos hashes
  en la licencia (`hardwareId` + `hardwareIdV2`, Gate 1 pasa si alguno coincide);
  (b) re-emitir licencias (hay un solo tier de clientes fundadores — barato);
  (c) mantener la MAC como componente pero obtenida vía WMI físico — salva
  licencias cuya MAC anclada era la del NIC físico primario.
- **Hostile-fallback**: si todas las capas WMI fallan → `UNKNOWN_MAC` actual —
  pero loguéalo y muestra `detectedHwId` real en la pantalla de activación.
- El validador es CommonJS standalone compilado a .jsc: no puede importar
  `node-wmi` ni dependencias — solo `child_process.execSync` + `os` + `crypto`.
  Aceptable: corre una sola vez en `app.whenReady()`.

## 6. Veredicto

El hash muta offline porque el único componente variable del fingerprint —la MAC—
se obtiene de `os.networkInterfaces()`, cuya visibilidad depende del estado de
la pila de red. En una máquina solo-Wi-Fi (la afectada), apagar la radio deja
cero candidatos → `UNKNOWN_MAC` → hash distinto → Gate 1 rechaza la licencia
válida. El parche V-06 solucionó el secuestro por adaptadores virtuales pero no
la desaparición del ancla físico. La corrección estable es anclar el HWID a
identidad de hardware que no dependa del estado de la red (`Win32_ComputerSystemProduct.UUID`
como ancla primaria, NIC físico vía WMI como secundaria), con `os.networkInterfaces()`
relegado a último recurso.
