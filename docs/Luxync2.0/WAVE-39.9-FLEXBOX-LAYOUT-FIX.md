# 🏗️ WAVE 39.9 - FLEXBOX STRUCTURAL LAYOUT FIX

**Fecha**: 18 Diciembre 2025  
**Problema**: TitleBar se superponía al contenido tras navegar entre tabs/subtabs  
**Estado**: ✅ RESUELTO

---

## 🐛 Bug Original

La TitleBar usaba `position: fixed` con un `padding-top: 32px` mágico en el layout principal. Esto causaba:

1. **Overlap al navegar**: Al cambiar entre tabs, el contenido se renderizaba encima de la TitleBar
2. **Subtabs rotas**: Las subtabs (ej: "MONITOR & CONTROL" en LuxCore) también sufrían overlap
3. **Layout frágil**: Dependía de valores hardcodeados que se rompían fácilmente

---

## 🔧 Solución: Flexbox Estructural

### Arquitectura Nueva

```
.app-layout (flex-column, 100vh)
├── .global-title-bar (flex: 0 0 auto, 32px)  ← Bloque sólido arriba
└── .main-layout (flex: 1, flex-row)           ← Resto del espacio
    ├── .sidebar (width: 280px, flex-shrink: 0)
    └── .layout-content (flex: 1)
        ├── .content-area (flex: 1, position: relative)
        │   └── .view-container (position: absolute, inset: 0)
        └── .global-effects-bar
```

### Cambios Clave

#### 1. `MainLayout.tsx` - Nuevo wrapper

```tsx
<div className="app-layout">
  <TitleBar />           {/* Flex item - NO position:fixed */}
  <div className="main-layout">
    <Sidebar />
    <div className="layout-content">
      <ContentArea />
      <GlobalEffectsBar />
    </div>
  </div>
</div>
```

#### 2. `MainLayout.css` - Flex column principal

```css
.app-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.main-layout {
  display: flex;
  flex: 1;
  min-height: 0;  /* Crucial para overflow en flex children */
}
```

#### 3. `TitleBar.css` - Eliminado position:fixed

```css
.global-title-bar {
  /* ANTES: position: fixed; top: 0; left: 0; right: 0; */
  /* AHORA: */
  flex: 0 0 auto;
  height: 32px;
  width: 100%;
  -webkit-app-region: drag;
}
```

#### 4. `Sidebar.css` - height: 100% (no vh)

```css
.sidebar {
  width: 280px;
  flex-shrink: 0;
  height: 100%;  /* ANTES: 100vh - rompía con el nuevo layout */
}
```

#### 5. `ContentArea.css` - Contención correcta

```css
.content-area {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0;
  min-width: 0;  /* Evita que crezca más allá del parent */
}

.view-container {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
}
```

---

## 📐 Por Qué Funciona

| Concepto | Explicación |
|----------|-------------|
| `flex-direction: column` | Apila TitleBar + contenido verticalmente |
| `flex: 0 0 auto` en TitleBar | Altura fija, no crece ni encoge |
| `flex: 1` en main-layout | Ocupa todo el espacio restante |
| `min-height: 0` | Permite que flex children hagan overflow correctamente |
| `min-width: 0` | Evita que el contenido empuje al sidebar fuera |
| `position: relative` + `absolute` | View-container llena exactamente el content-area |

---

## 🚨 Errores Comunes a Evitar

1. **NO usar `height: 100vh`** en elementos dentro del flex layout (usar `height: 100%` o `flex: 1`)
2. **NO olvidar `min-height: 0`** en flex containers que necesitan scroll
3. **NO usar `position: fixed`** para elementos que deben fluir con el layout
4. **SÍ usar `flex-shrink: 0`** en elementos de tamaño fijo (sidebar, titlebar)

---

## 📁 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `MainLayout.tsx` | Nuevo wrapper `.app-layout` |
| `MainLayout.css` | Estructura flex-column |
| `TitleBar.css` | Eliminado position:fixed |
| `Sidebar.css` | height: 100% + flex-shrink: 0 |
| `ContentArea.css` | min-width: 0, contención correcta |

---

## ✅ Resultado

- TitleBar es un **bloque físico** arriba - imposible de solapar
- Sidebar se mantiene visible correctamente
- Navegación entre tabs/subtabs **no rompe el layout**
- Scroll funciona correctamente dentro del content-area
