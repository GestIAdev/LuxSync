Summary of Changes
Root cause: Vibe clips were assigned trackId = 'vibe' during hydration and flat-clip extraction. Since 'vibe' is only a UI structural track ID (not a store track), _distributeClips couldn't match any store track and sent all vibe clips to tracks[0] (GLOBAL). This affected energy zone tracks disproportionately because that's where vibe clips are typically placed.

Fix — 2 files, 3 edits:

@/electron-app/src/chronos/core/LuxFileV3.factories.ts:345 — toChronosProjectV3 now passes t.id (parent track ID) to luxClipToTimelineClip for ALL clips, instead of 'vibe' for vibe clips. Vibe clips now retain their parent track's ID during load.
@/electron-app/src/chronos/core/ChronosStore.ts:209-214 — _getFlatClips no longer forces clip.trackId = 'vibe' for vibe clips. Clips are returned as-is, preserving their original track assignment.
@/electron-app/src/chronos/core/ChronosStore.ts:216-220 — Updated _distributeClips JSDoc to reflect the new behavior (unassigned = unknown trackId only, no 'vibe' special case).