# 🎸 FIXTURES

Esta carpeta contiene los perfiles de fixtures DMX.

## Uso

### Opción 1: Symlink a FreeStyler

```bash
# Linux/Mac
ln -s /path/to/FreeStyler/Fixtures ./fixtures

# Windows (PowerShell admin)
New-Item -ItemType SymbolicLink -Path .\fixtures -Target "C:\FreeStyler\Fixtures"
```

### Opción 2: Copiar fixtures

```bash
cp /path/to/FreeStyler/Fixtures/*.fxt ./fixtures/
```

### Opción 3: Crear fixture custom

Ver `docs/FIXTURES.md` para documentación completa.
