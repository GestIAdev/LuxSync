# WAVE 369.5: FILE SYSTEM DIALOGS & TITLE SYNC 📁

**Status:** ✅ COMPLETE  
**Type:** UX Polish + File Management  
**Dependencies:** WAVE 365 (Stage Persistence V2), WAVE 369 (Camera Lock)

---

## 🎯 OBJECTIVE

Implementar diálogos nativos del sistema para Open/Save As y sincronizar el título del show con el nombre del archivo.

---

## 📋 IMPLEMENTATION SUMMARY

### 1. Native File Dialogs (Electron IPC)

**File:** `electron/ipc/StageIPCHandlers.ts`

```typescript
// New Handlers Added:
'lux:stage:openDialog'      // Native Open File dialog
'lux:stage:saveAsDialog'    // Native Save As dialog  
'lux:stage:confirmUnsaved'  // "Unsaved changes" confirmation
```

**Dialog Features:**
- `.luxshow` and `.v2.luxshow` file filters
- Default path: User's shows folder (`LuxSync Shows/`)
- Three-button confirm: Save | Don't Save | Cancel

### 2. Preload Bridge

**File:** `electron/preload.ts`

```typescript
stage: {
  // ...existing methods...
  openDialog: () => Promise<{ success, cancelled?, filePath?, showFile? }>
  saveAsDialog: (showFile, suggestedName?) => Promise<{ success, cancelled?, filePath? }>
  confirmUnsaved: (showName) => Promise<'save' | 'discard' | 'cancel'>
}
```

### 3. TypeScript Definitions

**File:** `src/vite-env.d.ts`

Added complete `stage` interface with all methods typed:
- `load`, `loadActive`, `save`, `saveAs`
- `list`, `recent`, `delete`, `getPath`, `exists`
- `openDialog`, `saveAsDialog`, `confirmUnsaved`
- `onLoaded` event subscription

### 4. Toolbar UX

**File:** `src/components/views/StageConstructorView.tsx`

**New Features:**
- **Editable Title:** Double-click to rename show inline
- **Smart Save:** Auto-triggers Save As for "Untitled Stage"
- **New Stage:** Creates fresh show with unsaved changes check
- **Open Dialog:** Native file picker with conflict detection

**User Flow:**
```
[New] → Confirm unsaved? → newShow('Untitled Stage')
[Save] → Is untitled? → SaveAsDialog : Save to existing path
[Open] → Confirm unsaved? → OpenDialog → Load selected show
[Title] → Double-click → Edit inline → Enter/Blur saves
```

---

## 🔧 TECHNICAL DETAILS

### IPC Handlers

```typescript
// StageIPCHandlers.ts
ipcMain.handle('lux:stage:openDialog', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open LuxSync Show',
    filters: [{ name: 'LuxSync Shows', extensions: ['luxshow', 'v2.luxshow'] }],
    properties: ['openFile'],
    defaultPath: stagePersistence.getShowsPath()
  })
  // Returns show data if file selected
})

ipcMain.handle('lux:stage:saveAsDialog', async (_, showFile, suggestedName) => {
  const result = await dialog.showSaveDialog({
    title: 'Save LuxSync Show',
    defaultPath: path.join(getShowsPath(), `${suggestedName}.luxshow`),
    filters: [{ name: 'LuxSync Show', extensions: ['luxshow'] }]
  })
  // Saves and returns new path
})

ipcMain.handle('lux:stage:confirmUnsaved', async (_, showName) => {
  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Unsaved Changes',
    message: `"${showName}" has unsaved changes.`,
    detail: 'Do you want to save before continuing?'
  })
  // Returns 'save' | 'discard' | 'cancel'
})
```

### Smart Save Logic

```typescript
const handleSave = async () => {
  const isUntitled = showFile.name === 'Untitled Stage' || !showFilePath
  
  if (isUntitled) {
    // Trigger Save As dialog for new/untitled shows
    const result = await window.lux.stage.saveAsDialog(showFile, showFile.name)
    if (result.success && result.filePath) {
      const savedName = result.filePath.split(/[/\\]/).pop()?.replace(/\.luxshow$/, '')
      showFile.name = savedName
      setState({ showFilePath: result.filePath, isDirty: false })
    }
  } else {
    // Direct save to existing path
    await saveShow()
  }
}
```

### Editable Title

```tsx
{isEditingTitle ? (
  <input
    ref={titleInputRef}
    defaultValue={showFile.name}
    onBlur={() => { /* save and exit edit mode */ }}
    onKeyDown={(e) => {
      if (e.key === 'Enter') { /* save */ }
      if (e.key === 'Escape') { /* cancel */ }
    }}
  />
) : (
  <span onDoubleClick={() => setIsEditingTitle(true)}>
    {showFile.name}
    {isDirty && <span className="dirty-indicator">●</span>}
  </span>
)}
```

---

## 📁 FILES MODIFIED

| File | Changes |
|------|---------|
| `electron/ipc/StageIPCHandlers.ts` | +3 IPC handlers (openDialog, saveAsDialog, confirmUnsaved) |
| `electron/preload.ts` | +3 methods in stage object |
| `src/vite-env.d.ts` | +100 lines: Complete stage interface typing |
| `src/components/views/StageConstructorView.tsx` | Rewrote ConstructorToolbar with file management UX |

---

## ✅ VERIFICATION

- [x] TypeScript compiles without errors
- [x] `stage` interface fully typed in vite-env.d.ts
- [x] Open dialog shows .luxshow files
- [x] Save As dialog suggests default name
- [x] Unsaved changes confirmation works
- [x] Title editable via double-click
- [x] Dirty indicator (●) shows when modified

---

## 🎬 NEXT STEPS

- Test full file workflow: New → Edit → Save → Open → Edit → Save As
- Add keyboard shortcuts: Ctrl+S (Save), Ctrl+Shift+S (Save As), Ctrl+O (Open)
- Consider auto-save draft functionality

---

**WAVE 369.5 Status:** ✅ COMPLETE - File management UX ready for use
