[ZOMBIE-DIAG] clearSpatialTargets called for: (6) ['fixture-1778098981365', 'fixture-1778098987590', 'fixture-1778098998853', 'fixture-1778099003797', 'fixture-1778099032397', 'fixture-1778099037840']
KineticsBridge.ts:628 [ZOMBIE-DIAG] _flushPattern payload: {enginePattern: 'sweep', fixtureIds: 6, isStop: false, samePatternAndFixtures: false, activePattern: 'sweep'}
KineticsBridge.ts:629 [SONDA L2-FRONT] Enviando patrón: sweep Fixtures: 6 (anchor delegado al backend)
useSeleneTruth.ts:95 [useSeleneTruth 🩸] TRUTH received. frameCountRef=8 system.frameNumber=1320
programmerStore.ts:893 [ZOMBIE-DIAG] clearSpatialTargets called for: (6) ['fixture-1778098981365', 'fixture-1778098987590', 'fixture-1778098998853', 'fixture-1778099003797', 'fixture-1778099032397', 'fixture-1778099037840']
KineticsBridge.ts:628 [ZOMBIE-DIAG] _flushPattern payload: {enginePattern: 'hold', fixtureIds: 6, isStop: true, samePatternAndFixtures: false, activePattern: 'none'}
KineticsBridge.ts:629 [SONDA L2-FRONT] Enviando patrón: hold Fixtures: 6 (anchor delegado al backend)
useSeleneTruth.ts:95 [useSeleneTruth 🩸] TRUTH received. frameCountRef=10 system.frameNumber=1584
KineticsCathedral.tsx:143 [ZOMBIE-DIAG] 🚨 UNLOCK STARTED. selectedIds: (6) ['fixture-1778098981365', 'fixture-1778098987590', 'fixture-1778098998853', 'fixture-1778099003797', 'fixture-1778099032397', 'fixture-1778099037840']
KineticsCathedral.tsx:149 [ZOMBIE-DIAG] Pre-Unlock fixtureOverrides con spatial: []
KineticsCathedral.tsx:150 [ZOMBIE-DIAG] Pre-Unlock cellOverrides con spatial: []
KineticsCathedral.tsx:158 [ZOMBIE-DIAG] Step 1: clearSpatialTargets
programmerStore.ts:893 [ZOMBIE-DIAG] clearSpatialTargets called for: (6) ['fixture-1778098981365', 'fixture-1778098987590', 'fixture-1778098998853', 'fixture-1778099003797', 'fixture-1778099032397', 'fixture-1778099037840']
KineticsCathedral.tsx:163 [ZOMBIE-DIAG] Step 1b: IPC purgeBaseSpatial
KineticsCathedral.tsx:167 [ZOMBIE-DIAG] Step 2: releaseKinetics
programmerStore.ts:1108 [ZOMBIE-DIAG] releaseKinetics ENTER
programmerStore.ts:1124 [ZOMBIE-DIAG] releaseKinetics cleared 0 kinetic cells. pendingClearNodeIds=0
KineticsCathedral.tsx:171 [ZOMBIE-DIAG] Step 3: IPC setManualPattern(null)
KineticsCathedral.tsx:179 [ZOMBIE-DIAG] Step 4: IPC setKineticFanOffsets({})
KineticsCathedral.tsx:183 [ZOMBIE-DIAG] Step 5: IPC clearAllMotorKineticOverrides
KineticsCathedral.tsx:189 [ZOMBIE-DIAG] Step 6: setActivePattern(none) → ESCUDO _isUnlocking ON
KineticsCathedral.tsx:204 [ZOMBIE-DIAG] Step 7: resetRadarSilent
KineticsCathedral.tsx:212 [ZOMBIE-DIAG] ✅ UNLOCK SEQUENCE COMPLETE
KineticsCathedral.tsx:196 [ZOMBIE-DIAG] _isUnlocking shield OFF (50ms)

------------------------------------------

BACKEND

[CHOREO] techno-club | #0:scan_x [MIRROR ×2] | scene:15b | Pan:-150 Tilt:-85 | sBPM:126 phase:328°
[ZOMBIE-DIAG] resetSpatialState fixture-1778098981365:kinetic: 3D state exorcized
[ZOMBIE-DIAG] resetSpatialState fixture-1778098987590:kinetic: 3D state exorcized
[ZOMBIE-DIAG] resetSpatialState fixture-1778098998853:kinetic: 3D state exorcized
[ZOMBIE-DIAG] resetSpatialState fixture-1778099003797:kinetic: 3D state exorcized
[ZOMBIE-DIAG] resetSpatialState fixture-1778099032397:kinetic: 3D state exorcized
[ZOMBIE-DIAG] resetSpatialState fixture-1778099037840:kinetic: 3D state exorcized
[ZOMBIE-DIAG] 🔥 setManualPattern ENTER. Payload: {
  fixtureIds: 6,
  pattern: null,
  speed: 50,
  amplitude: 50,
  fan: undefined,
  anchorPan: undefined,
  anchorTilt: undefined
}
[ZOMBIE-DIAG] Pre-op state fixture-1778098981365:kinetic: manualKeys=[pan_base,tilt_base] motorKeys=[none]
[ZOMBIE-DIAG] Pre-op state fixture-1778098987590:kinetic: manualKeys=[pan_base,tilt_base] motorKeys=[none]
[ZOMBIE-DIAG] Pre-op state fixture-1778098998853:kinetic: manualKeys=[pan_base,tilt_base] motorKeys=[none]
[ZOMBIE-DIAG] Pre-op state fixture-1778099003797:kinetic: manualKeys=[pan_base,tilt_base] motorKeys=[none]
[ZOMBIE-DIAG] Pre-op state fixture-1778099032397:kinetic: manualKeys=[pan_base,tilt_base] motorKeys=[none]
[ZOMBIE-DIAG] Pre-op state fixture-1778099037840:kinetic: manualKeys=[pan_base,tilt_base] motorKeys=[none]
[ZOMBIE-DIAG] → Branch RELEASE/NULL (destructive purge — NO fade)
[ZOMBIE-DIAG] Post-RELEASE fixture-1778098981365:kinetic: manual=CLEARED motor=CLEARED
[ZOMBIE-DIAG] Post-RELEASE fixture-1778098987590:kinetic: manual=CLEARED motor=CLEARED
[ZOMBIE-DIAG] Post-RELEASE fixture-1778098998853:kinetic: manual=CLEARED motor=CLEARED
[ZOMBIE-DIAG] Post-RELEASE fixture-1778099003797:kinetic: manual=CLEARED motor=CLEARED
[ZOMBIE-DIAG] Post-RELEASE fixture-1778099032397:kinetic: manual=CLEARED motor=CLEARED
[ZOMBIE-DIAG] Post-RELEASE fixture-1778099037840:kinetic: manual=CLEARED motor=CLEARED
[CHOREO] Pattern → AI control (Selene)
[CHOREO] Speed -> AI control
[CHOREO] Amplitude -> AI control
[ZOMBIE-DIAG] ✅ RELEASE branch complete
[ZOMBIE-DIAG] IPC clearAllMotorKineticOverrides called
[ZOMBIE-DIAG] clearAllMotorKineticOverrides: 0 entries cleared