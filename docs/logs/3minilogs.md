built in 1413ms.
dist-electron/mind.js  14.07 kB │ gzip: 4.16 kB
dist-electron/mind.js  14.07 kB │ gzip: 4.16 kB (x2)
built in 1584ms.
dist-electron/senses.js  105.70 kB │ gzip: 28.82 kB
dist-electron/senses.js  105.70 kB │ gzip: 28.82 kB (x2)
built in 1593ms.
✓ 207 modules transformed.
dist-electron/main.js  2,015.18 kB │ gzip: 485.28 kB
built in 3907ms.

[TitanOrchestrator] WAVE 3401: OSCNexusProvider started (UDP 9000/9001)
[VirtualWire] initialize() — checking native bridge...
[NativeAudio] Loading native addon luxsync_audio...
[NativeAudio] ✅ Native addon loaded successfully
[OmniInput] enumerateDevices() called
[WASAPI] enumerateFlow: flow=eCapture found 3 active endpoints
[WASAPI] Device[0]: "Varios micrófonos (Realtek(R) Audio)   " | 2ch @ 44100Hz | loopback=false | excl=false | default=false | id={0.0.1.00000000}.{29479fd1-8d96-4515-8e27-6f6190b19589}
[WASAPI] Device[1]: "Mezcla estéreo (Realtek(R) Audio)      " | 2ch @ 48000Hz | loopback=false | excl=false | default=false | id={0.0.1.00000000}.{6df96db5-8606-4036-8709-152286b57c54}
[WASAPI] Device[2]: "CABLE Output (VB-Audio Virtual Cable)   " | 2ch @ 44100Hz | loopback=false | excl=false | default=true  | id={0.0.1.00000000}.{a1fbd0a5-bad6-4c84-b057-52db0177788b}
[WASAPI] enumerateFlow: flow=eRender found 3 active endpoints
[WASAPI] Device[3]: "CABLE In 16ch (VB-Audio Virtual Cable)  " | 2ch @ 44100Hz | loopback=true  | excl=false | default=false | id={0.0.0.00000000}.{30c0ab7c-7f6a-40af-8b4d-5cc743cd469b}
[WASAPI] Device[4]: "Auriculares (Realtek(R) Audio)          " | 2ch @ 48000Hz | loopback=true  | excl=false | default=false | id={0.0.0.00000000}.{743e91cf-d33d-4066-b3ac-10b36be77a73}
[WASAPI] Device[5]: "CABLE Input (VB-Audio Virtual Cable)    " | 2ch @ 44100Hz | loopback=true  | excl=false | default=true  | id={0.0.0.00000000}.{f9a440de-48be-43af-aeb4-0892442cef3d}
[OmniInput] enumerateDevices() returned 6 devices
[NativeAudio] Device enumeration — 6 device(s) found:
[NativeAudio]   [WASAPI] "Varios micrófonos (Realtek(R) Audio)" | 2ch @ 44100Hz | flags: [shared-only] | supported rates: [] | id: {0.0.1.00000000}.{29479fd1-8d96-4515-8e27-6f6190b19589}
[NativeAudio]   [WASAPI] "Mezcla estéreo (Realtek(R) Audio)" | 2ch @ 48000Hz | flags: [shared-only] | supported rates: [] | id: {0.0.1.00000000}.{6df96db5-8606-4036-8709-152286b57c54}
[NativeAudio]   [WASAPI] "CABLE Output (VB-Audio Virtual Cable)" | 2ch @ 44100Hz | flags: [DEFAULT] | supported rates: [] | id: {0.0.1.00000000}.{a1fbd0a5-bad6-4c84-b057-52db0177788b}
[NativeAudio]   [WASAPI] "CABLE In 16ch (VB-Audio Virtual Cable)" | 2ch @ 44100Hz | flags: [LOOPBACK] | supported rates: [] | id: {0.0.0.00000000}.{30c0ab7c-7f6a-40af-8b4d-5cc743cd469b}
[NativeAudio]   [WASAPI] "Auriculares (Realtek(R) Audio)" | 2ch @ 48000Hz | flags: [LOOPBACK] | supported rates: [] | id: {0.0.0.00000000}.{743e91cf-d33d-4066-b3ac-10b36be77a73}
[NativeAudio]   [WASAPI] "CABLE Input (VB-Audio Virtual Cable)" | 2ch @ 44100Hz | flags: [DEFAULT, LOOPBACK] | supported rates: [] | id: {0.0.0.00000000}.{f9a440de-48be-43af-aeb4-0892442cef3d}
[NativeAudio] ✅ Loopback device(s) detected: "CABLE In 16ch (VB-Audio Virtual Cable)", "Auriculares (Realtek(R) Audio)", "CABLE Input (VB-Audio Virtual Cable)"
[VirtualWire] Auto-detected virtual capture device: "CABLE Input (VB-Audio Virtual Cable)" ({0.0.0.00000000}.{f9a440de-48be-43af-aeb4-0892442cef3d}) — isLoopback=true
[VirtualWire] ✅ Initialized — device: "CABLE Input (VB-Audio Virtual Cable)" ready, waiting for start()
[TitanOrchestrator] WAVE 3402: VirtualWireProvider registered
[OmniInput] enumerateDevices() called
[WASAPI] enumerateFlow: flow=eCapture found 3 active endpoints
[WASAPI] Device[0]: "Varios micrófonos (Realtek(R) Audio)   " | 2ch @ 44100Hz | loopback=false | excl=false | default=false | id={0.0.1.00000000}.{29479fd1-8d96-4515-8e27-6f6190b19589}
[WASAPI] Device[1]: "Mezcla estéreo (Realtek(R) Audio)      " | 2ch @ 48000Hz | loopback=false | excl=false | default=false | id={0.0.1.00000000}.{6df96db5-8606-4036-8709-152286b57c54}
[WASAPI] Device[2]: "CABLE Output (VB-Audio Virtual Cable)   " | 2ch @ 44100Hz | loopback=false | excl=false | default=true  | id={0.0.1.00000000}.{a1fbd0a5-bad6-4c84-b057-52db0177788b}
[WASAPI] enumerateFlow: flow=eRender found 3 active endpoints
[WASAPI] Device[3]: "CABLE In 16ch (VB-Audio Virtual Cable)  " | 2ch @ 44100Hz | loopback=true  | excl=false | default=false | id={0.0.0.00000000}.{30c0ab7c-7f6a-40af-8b4d-5cc743cd469b}
[WASAPI] Device[4]: "Auriculares (Realtek(R) Audio)          " | 2ch @ 48000Hz | loopback=true  | excl=false | default=false | id={0.0.0.00000000}.{743e91cf-d33d-4066-b3ac-10b36be77a73}
[WASAPI] Device[5]: "CABLE Input (VB-Audio Virtual Cable)    " | 2ch @ 44100Hz | loopback=true  | excl=false | default=true  | id={0.0.0.00000000}.{f9a440de-48be-43af-aeb4-0892442cef3d}
[OmniInput] enumerateDevices() returned 6 devices
[NativeAudio] Device enumeration — 6 device(s) found:
[NativeAudio]   [WASAPI] "Varios micrófonos (Realtek(R) Audio)" | 2ch @ 44100Hz | flags: [shared-only] | supported rates: [] | id: {0.0.1.00000000}.{29479fd1-8d96-4515-8e27-6f6190b19589}
[NativeAudio]   [WASAPI] "Mezcla estéreo (Realtek(R) Audio)" | 2ch @ 48000Hz | flags: [shared-only] | supported rates: [] | id: {0.0.1.00000000}.{6df96db5-8606-4036-8709-152286b57c54}
[NativeAudio]   [WASAPI] "CABLE Output (VB-Audio Virtual Cable)" | 2ch @ 44100Hz | flags: [DEFAULT] | supported rates: [] | id: {0.0.1.00000000}.{a1fbd0a5-bad6-4c84-b057-52db0177788b}
[NativeAudio]   [WASAPI] "CABLE In 16ch (VB-Audio Virtual Cable)" | 2ch @ 44100Hz | flags: [LOOPBACK] | supported rates: [] | id: {0.0.0.00000000}.{30c0ab7c-7f6a-40af-8b4d-5cc743cd469b}
[NativeAudio]   [WASAPI] "Auriculares (Realtek(R) Audio)" | 2ch @ 48000Hz | flags: [LOOPBACK] | supported rates: [] | id: {0.0.0.00000000}.{743e91cf-d33d-4066-b3ac-10b36be77a73}
[NativeAudio]   [WASAPI] "CABLE Input (VB-Audio Virtual Cable)" | 2ch @ 44100Hz | flags: [DEFAULT, LOOPBACK] | supported rates: [] | id: {0.0.0.00000000}.{f9a440de-48be-43af-aeb4-0892442cef3d}
[NativeAudio] ✅ Loopback device(s) detected: "CABLE In 16ch (VB-Audio Virtual Cable)", "Auriculares (Realtek(R) Audio)", "CABLE Input (VB-Audio Virtual Cable)"
[TitanOrchestrator] WAVE 3402: USBDirectLinkProvider registered
[UniversalDMX] 🌑 Blackout (1 universes)
Files in the public directory are served at the root path.
Instead of /public/interpreted_vector_logo.png, use /interpreted_vector_logo.png.
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[TitanOrchestrator] 🌊 Layout: 4.1
[TitanOrchestrator] 🌊 Layout: 4.1
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[TitanOrchestrator] Vibe set to: techno-club
[TitanOrchestrator] 🎯 WAVE 289: Vibe propagated to Workers
[TitanOrchestrator] 🎛️ WAVE 338: Movement physics updated for vibe
[TitanOrchestrator] 🧨 WAVE 2140: Pacemaker reset triggered by vibe change → techno-club
[TitanOrchestrator] 🧹 WAVE 3230: Layer 2 purged — Clean Slate for vibe techno-club
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[CHOREO] techno-club | scan_x [MIRROR F0/2] | Bar:0 | Pan:11 Tilt:-32 | sBPM:120 phase:176°
[CHOREO] techno-club | scan_x [MIRROR F1/2] | Bar:0 | Pan:111 Tilt:11 | sBPM:120 phase:176°
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[CHOREO] techno-club | scan_x [MIRROR F0/2] | Bar:0 | Pan:-40 Tilt:-45 | sBPM:120 phase:346°
[CHOREO] techno-club | scan_x [MIRROR F1/2] | Bar:0 | Pan:-87 Tilt:7 | sBPM:120 phase:346°
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[CHOREO] techno-club | scan_x [MIRROR F0/2] | Bar:0 | Pan:67 Tilt:-55 | sBPM:120 phase:156°
[CHOREO] techno-club | scan_x [MIRROR F1/2] | Bar:0 | Pan:61 Tilt:-1 | sBPM:120 phase:156°
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[CHOREO] techno-club | scan_x [MIRROR F0/2] | Bar:0 | Pan:-97 Tilt:-63 | sBPM:120 phase:325°
[CHOREO] techno-club | scan_x [MIRROR F1/2] | Bar:0 | Pan:-29 Tilt:-14 | sBPM:120 phase:325°
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[CHOREO] techno-club | scan_x [MIRROR F0/2] | Bar:0 | Pan:119 Tilt:-65 | sBPM:120 phase:135°
[CHOREO] techno-club | scan_x [MIRROR F1/2] | Bar:0 | Pan:0 Tilt:-27 | sBPM:120 phase:135°
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[CHOREO] techno-club | scan_x [MIRROR F0/2] | Bar:0 | Pan:-138 Tilt:-62 | sBPM:120 phase:305°
[CHOREO] techno-club | scan_x [MIRROR F1/2] | Bar:0 | Pan:30 Tilt:-40 | sBPM:120 phase:305°
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[TitanOrchestrator] 🌊 Layout: 4.1
[TitanOrchestrator] 🌊 Layout: 4.1
[CHOREO] techno-club | scan_x [MIRROR F0/2] | Bar:0 | Pan:154 Tilt:-55 | sBPM:120 phase:114°
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[CHOREO] techno-club | scan_x [MIRROR F0/2] | Bar:0 | Pan:-166 Tilt:-41 | sBPM:120 phase:281°
[CHOREO] techno-club | scan_x [MIRROR F1/2] | Bar:0 | Pan:95 Tilt:-62 | sBPM:120 phase:281°
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[CHOREO] techno-club | scan_x [MIRROR F0/2] | Bar:0 | Pan:168 Tilt:-28 | sBPM:120 phase:91°
[CHOREO] techno-club | scan_x [MIRROR F1/2] | Bar:0 | Pan:-118 Tilt:-65 | sBPM:120 phase:91°
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[CHOREO] techno-club | scan_x [MIRROR F0/2] | Bar:0 | Pan:-166 Tilt:-14 | sBPM:120 phase:260°
[CHOREO] techno-club | scan_x [MIRROR F1/2] | Bar:0 | Pan:137 Tilt:-63 | sBPM:120 phase:260°
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[CHOREO] techno-club | scan_x [MIRROR F0/2] | Bar:0 | Pan:158 Tilt:-2 | sBPM:120 phase:70°
[CHOREO] techno-club | scan_x [MIRROR F1/2] | Bar:0 | Pan:-153 Tilt:-56 | sBPM:120 phase:70°
[VirtualWire] start() — current state: "ready"
[OmniInput] enumerateDevices() called
[WASAPI] enumerateFlow: flow=eCapture found 3 active endpoints
[WASAPI] Device[0]: "Varios micrófonos (Realtek(R) Audio)   " | 2ch @ 44100Hz | loopback=false | excl=false | default=false | id={0.0.1.00000000}.{29479fd1-8d96-4515-8e27-6f6190b19589}
[WASAPI] Device[1]: "Mezcla estéreo (Realtek(R) Audio)      " | 2ch @ 48000Hz | loopback=false | excl=false | default=false | id={0.0.1.00000000}.{6df96db5-8606-4036-8709-152286b57c54}
[WASAPI] Device[2]: "CABLE Output (VB-Audio Virtual Cable)   " | 2ch @ 44100Hz | loopback=false | excl=false | default=true  | id={0.0.1.00000000}.{a1fbd0a5-bad6-4c84-b057-52db0177788b}
[WASAPI] enumerateFlow: flow=eRender found 3 active endpoints
[WASAPI] Device[3]: "CABLE In 16ch (VB-Audio Virtual Cable)  " | 2ch @ 44100Hz | loopback=true  | excl=false | default=false | id={0.0.0.00000000}.{30c0ab7c-7f6a-40af-8b4d-5cc743cd469b}
[WASAPI] Device[4]: "Auriculares (Realtek(R) Audio)          " | 2ch @ 48000Hz | loopback=true  | excl=false | default=false | id={0.0.0.00000000}.{743e91cf-d33d-4066-b3ac-10b36be77a73}
[WASAPI] Device[5]: "CABLE Input (VB-Audio Virtual Cable)    " | 2ch @ 44100Hz | loopback=true  | excl=false | default=true  | id={0.0.0.00000000}.{f9a440de-48be-43af-aeb4-0892442cef3d}
[OmniInput] enumerateDevices() returned 6 devices
[NativeAudio] Device enumeration — 6 device(s) found:
[NativeAudio]   [WASAPI] "Varios micrófonos (Realtek(R) Audio)" | 2ch @ 44100Hz | flags: [shared-only] | supported rates: [] | id: {0.0.1.00000000}.{29479fd1-8d96-4515-8e27-6f6190b19589}
[NativeAudio]   [WASAPI] "Mezcla estéreo (Realtek(R) Audio)" | 2ch @ 48000Hz | flags: [shared-only] | supported rates: [] | id: {0.0.1.00000000}.{6df96db5-8606-4036-8709-152286b57c54}
[NativeAudio]   [WASAPI] "CABLE Output (VB-Audio Virtual Cable)" | 2ch @ 44100Hz | flags: [DEFAULT] | supported rates: [] | id: {0.0.1.00000000}.{a1fbd0a5-bad6-4c84-b057-52db0177788b}
[NativeAudio]   [WASAPI] "CABLE In 16ch (VB-Audio Virtual Cable)" | 2ch @ 44100Hz | flags: [LOOPBACK] | supported rates: [] | id: {0.0.0.00000000}.{30c0ab7c-7f6a-40af-8b4d-5cc743cd469b}
[NativeAudio]   [WASAPI] "Auriculares (Realtek(R) Audio)" | 2ch @ 48000Hz | flags: [LOOPBACK] | supported rates: [] | id: {0.0.0.00000000}.{743e91cf-d33d-4066-b3ac-10b36be77a73}
[NativeAudio]   [WASAPI] "CABLE Input (VB-Audio Virtual Cable)" | 2ch @ 44100Hz | flags: [DEFAULT, LOOPBACK] | supported rates: [] | id: {0.0.0.00000000}.{f9a440de-48be-43af-aeb4-0892442cef3d}
[NativeAudio] ✅ Loopback device(s) detected: "CABLE In 16ch (VB-Audio Virtual Cable)", "Auriculares (Realtek(R) Audio)", "CABLE Input (VB-Audio Virtual Cable)"
[VirtualWire] Starting native capture — device: "{0.0.0.00000000}.{f9a440de-48be-43af-aeb4-0892442cef3d}" | 1ch @ 44100Hz | exclusive: false | loopback: true
[NativeAudio] startCapture — device: "{0.0.0.00000000}.{f9a440de-48be-43af-aeb4-0892442cef3d}" | 1ch @ 44100Hz | bufferSize: 256 frames | exclusive: false
[OmniInput] startCapture: device='{0.0.0.00000000}.{f9a440de-48be-43af-aeb4-0892442cef3d}' rate=44100 ch=1 buf=256 excl=0 loopback=1
[OmniInput] startCapture OK — handle=1
[VirtualWire] ✅ Capture streaming — handle: 1
[WASAPI] Starting capture: device='{0.0.0.00000000}.{f9a440de-48be-43af-aeb4-0892442cef3d}' 44100Hz 1ch buf=256 exclusive=0 loopback=1 latency=22.00ms
[WASAPI] Capture loop running
[TitanOrchestrator] 🎧 WORKER BPM=0 conf=0.00 | PLL=FREEWHEEL phase=0.00 sync=0.00 | beat #0
[CHOREO] techno-club | scan_x [MIRROR F0/2] | Bar:0 | Pan:-149 Tilt:17 | sBPM:120 phase:229°
[CHOREO] techno-club | scan_x [MIRROR F1/2] | Bar:0 | Pan:197 Tilt:-33 | sBPM:120 phase:229°
[TitanOrchestrator] 🌊 Layout: 4.1
[TitanOrchestrator] 🌊 Layout: 4.1