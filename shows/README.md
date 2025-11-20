# 🎬 SHOWS

Esta carpeta almacena los shows grabados (formato `.luxshow`).

## Formato

Un archivo `.luxshow` es un JSON con:

```json
{
  "metadata": {
    "name": "Techno Night",
    "date": "2025-11-19T20:00:00Z",
    "duration": 3600,
    "seed": 42
  },
  "scenes": [
    {
      "timestamp": 0,
      "fixtures": [...],
      "audioContext": {...}
    }
  ]
}
```

## Replay

```bash
curl -X POST http://localhost:4000/graphql \
  -d '{"query":"mutation { replayShow(file: \"MiShow.luxshow\") }"}'
```
