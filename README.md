## ORIGIN

Experiencia narrativa situada en una casa de abuela en Buenos Aires. El recorrido mezcla aventura grafica, memoria familiar y una busqueda: descubrir quien quedo siempre detras de la camara.

El estado separa hechos observables, lecturas provisorias y estado dramatico. No hay puntos ni finales calculados por suma. Usa `?debug` para ver hotspots y estado interno.

## Voz

La narracion intenta usar Azure Speech desde `/api/tts` con `es-AR-TomasNeural`, una voz masculina argentina. Si no hay credenciales configuradas, el fallback local solo acepta voces sudamericanas del navegador; no usa voces de Espana ni Mexico.

Variables necesarias:

```bash
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=eastus
AZURE_SPEECH_VOICE=es-AR-TomasNeural
```

## Desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Deploy

Para Vercel, cargar las variables de Azure como Server Environment Variables. La clave queda protegida porque el navegador solo llama a `/api/tts`.

Para llevarlo al stack tipo Sendero con Supabase, la siguiente capa natural es guardar telemetria narrativa anonima:

- `origin_sessions`: id, created_at, ending, dominant_reading.
- `origin_events`: session_id, scene, object_id, gesture, dramatic_state, created_at.

Variables reservadas en `env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Build

```bash
npm run build
```
