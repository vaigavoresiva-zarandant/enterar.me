# Desplegar Ollama en Railway — ENTERAR.ME

Guía paso a paso para tener **Ollama** ejecutándose en Railway y
consumiéndolo desde el servicio `ai` de ENTERAR.ME.

> Ollama es el runtime de inferencia LLM que usa ENTERAR.ME para el agente
> IA (ENTERA) y para los embeddings RAG.

---

## 1. ¿Por qué Ollama en Railway?

| Razón              | Detalle                                                                                      |
|--------------------|----------------------------------------------------------------------------------------------|
| Coste controlado   | ~5–25 USD/mes en Hobby vs. facturación por token de OpenAI/Anthropic (que en SaaS con uso intensivo se dispara). |
| Siempre on         | Railway no cae si se cae tu VPS. Si tu Coolify se reinicia, el LLM sigue sirviendo.           |
| Sin gestionar GPU  | Railway no ofrece GPUs, pero los planes de CPU + 8GB RAM son suficientes para `qwen2.5:7b-instruct` en staging y cargas medias. |
| Privacidad         | Los datos del tenant no salen de infraestructura controlada por nosotros (Coolify + Railway). |
| Modelo custom      | El `Modelfile` define `enterarme-agent` con system prompt específico de las reglas de negocio. |
| Reproducible       | Mismo modelo + mismo prompt = mismo comportamiento.                                          |

**Trade-off**: ~5–15 tokens/seg en CPU-only. Para producción con mucha
carga, migrar a VPS con GPU (Hetzner CCX con GPU, GCP L4). Esta guía
sirve para staging y cargas medias.

> **Estado actual**: el archivo `ai/ollama-railway.md` (escrito por el
> agente 2-b) ya contiene una guía similar. Este documento la amplía y
> corrige con detalles operationales.

---

## 2. Crear proyecto en Railway

1. Entra en https://railway.app → **New Project**.
2. Elige:
   - **Deploy from GitHub repo** (si vas a usar la Opción B con Dockerfile custom), o
   - **Empty project** (si vas a usar la Opción A con imagen `ollama/ollama`).
3. Llama al proyecto `enterarme-ollama`.

---

## 3. Opción A: usar la imagen oficial `ollama/ollama`

Más simple pero requiere `ollama create` manual tras cada cold start.

### 3.1 Crear el servicio

1. **New → Docker Image** → busca `ollama/ollama:latest`.
2. Renombra el servicio a `ollama`.
3. **Settings → Networking → Generate Domain**: crea una URL pública
   tipo `enterarme-ollama.up.railway.app`.
4. **Añade un volumen** (Settings → Volumes → Add Volume):
   - **Mount path**: `/root/.ollama`
   - Esto persiste los modelos entre deploys (los modelos pesan GBs).

### 3.2 Variables de entorno

```
OLLAMA_HOST=0.0.0.0:11434
OLLAMA_ORIGINS=*
```

### 3.3 Recursos

En **Settings → Resources** sube CPU/RAM:

| Plan mínimo (dev)        | Plan recomendado (staging) | Plan producción (CPU)       |
|--------------------------|----------------------------|-----------------------------|
| 4 GB RAM / 2 vCPU        | 8 GB RAM / 4 vCPU          | 16 GB RAM / 8 vCPU          |

> `qwen2.5:7b-instruct` requiere ~5 GB de RAM cargado. `nomic-embed-text`
> añade ~300 MB. Reservar siempre 2 GB extra para el SO y el runtime.

### 3.4 Cargar los modelos (manual)

Abre una shell en Railway (servicio `ollama` → **Settings → Railway CLI**
o usa el panel web de ejecutivos):

```bash
# 1. Pull del modelo base
ollama pull qwen2.5:7b-instruct

# 2. Pull del modelo de embeddings
ollama pull nomic-embed-text

# 3. Subir el Modelfile (vía SCP, volumen compartido, o crear in-situ)
cat > /tmp/Modelfile <<'EOF'
FROM qwen2.5:7b-instruct
PARAMETER temperature 0.3
PARAMETER top_p 0.85
PARAMETER num_ctx 8192
PARAMETER stop "<|im_end|>"
SYSTEM """Eres el Agente IA de ENTERAR.ME..."""
EOF

# 4. Crear el modelo custom
ollama create enterarme-agent -f /tmp/Modelfile

# 5. Verificar
ollama list
# debe mostrar:
#   enterarme-agent:latest
#   nomic-embed-text:latest
#   qwen2.5:7b-instruct:latest
```

---

## 4. Opción B: imagen custom con el Modelfile pre-cargado (recomendada)

Evita tener que hacer `ollama create` manualmente tras cada cold start.

### 4.1 Crear el Dockerfile custom

Crea `ai/Dockerfile.ollama` en el repo (path sugerido):

```dockerfile
# ai/Dockerfile.ollama
FROM ollama/ollama:latest

# Copia el Modelfile al contenedor
COPY Modelfile /root/Modelfile

# Copia el entrypoint custom
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Variables por defecto
ENV OLLAMA_HOST=0.0.0.0:11434
ENV OLLAMA_ORIGINS=*

# Volumen para persistir modelos entre reinicios
VOLUME ["/root/.ollama"]

EXPOSE 11434

ENTRYPOINT ["/entrypoint.sh"]
```

### 4.2 Crear el `entrypoint.sh`

Crea `ai/entrypoint.sh`:

```bash
#!/bin/sh
set -e

# 1. Levantar ollama en background
ollama serve &
SERVER_PID=$!

# 2. Esperar a que arranque (polling al endpoint /api/tags)
echo "[entrypoint] Esperando a Ollama..."
until ollama list >/dev/null 2>&1; do
  sleep 1
done
echo "[entrypoint] Ollama listo."

# 3. Pre-pull base + embeddings + crear modelo custom
echo "[entrypoint] Descargando qwen2.5:7b-instruct..."
ollama pull qwen2.5:7b-instruct

echo "[entrypoint] Descargando nomic-embed-text..."
ollama pull nomic-embed-text

echo "[entrypoint] Creando enterarme-agent..."
ollama create enterarme-agent -f /root/Modelfile || true

echo "[entrypoint] Modelos listos. Sirviendo."
ollama list

# 4. Esperar al proceso principal
wait $SERVER_PID
```

Hazlo ejecutable:

```bash
chmod +x ai/entrypoint.sh
```

### 4.3 Desplegar en Railway

1. En Railway, en el servicio `ollama` → **Settings → Source** → cambia a
   "GitHub repo" y conecta el repo `enterarme/enterarme`, indicando la
   carpeta `ai/` como root y `Dockerfile.ollama` como Dockerfile path.
2. Variables de entorno (igual que Opción A):
   ```
   OLLAMA_HOST=0.0.0.0:11434
   OLLAMA_ORIGINS=*
   ```
3. Volumen: `/root/.ollama`.
4. **Deploy**. El primer deploy tarda ~5 min en descargar los modelos.

> Importante: si solo se modifica el `Modelfile` (cambio de system prompt),
> Railway rebuildeará la imagen pero el `ollama create` del entrypoint
> detectará que el modelo ya existe y lo reescribirá con el nuevo prompt.

---

## 5. Seguridad: proxy Caddy con Basic Auth

Ollama **no soporta auth nativo**. Exponerlo directamente en Railway es un
riesgo: cualquiera con la URL puede usar tu modelo y consumir CPU. Hay
que poner un proxy delante.

### 5.1 Opción recomendada: Caddy con Basic Auth

Crea **otro servicio Railway** con imagen `caddy:2-alpine` y este `Caddyfile`:

```caddyfile
:80 {
    # Solo permitimos si el header Authorization coincide con la API key
    @auth not header Authorization "Bearer {env.OLLAMA_API_KEY}"
    respond @auth 401

    # Proxy al servicio ollama interno de Railway
    reverse_proxy ollama.internal:11434 {
        header_up Host {upstream_host}
    }
}
```

> En Railway, los servicios del mismo proyecto se ven por hostname
> `<service-name>.internal`. Cambia `ollama.internal` por el nombre real
> de tu servicio Ollama.

Variables del servicio Caddy:

```
OLLAMA_API_KEY=genera-un-secreto-largo-y-aleatorio
```

Genera la API key:

```bash
openssl rand -hex 32
```

Exponer el servicio **Caddy** (no el `ollama` directo) en un dominio público,
p.ej. `enterarme-caddy.up.railway.app`.

### 5.2 Verificar

```bash
# Sin auth → 401
curl https://enterarme-caddy.up.railway.app/api/tags
# → 401

# Con auth → 200 y lista de modelos
curl https://enterarme-caddy.up.railway.app/api/tags \
  -H "Authorization: Bearer $OLLAMA_API_KEY"
# → { "models": [ ... ] }
```

### 5.3 Alternativa: Cloudflare Access / Tunnel

Si ya usas Cloudflare, puedes crear un Tunnel y proteger con Access
(Zero Trust). El servicio `ai` mandaría el token de servicio como bearer.
Más robusto pero requiere configuración extra en Cloudflare.

---

## 6. Cold start y cómo mantenerlo caliente

Railway suspende servicios inactivos (especialmente en plan Hobby). El
primer request tras inactividad puede tardar 10–60 s mientras Ollama
recarga el modelo en RAM.

### 6.1 Estrategias (combinables)

**A. Cron ping** (la más efectiva y barata):

El repo incluye un script listo para usar en `scripts/keep-ollama-warm.sh`.
Hace un ping al endpoint `/api/tags` (o `/api/generate` con prompt vacío)
cada N minutos y loguea el resultado.

Uso suelto:

```bash
# Variables de entorno obligatorias
export OLLAMA_HOST=https://<tu-caddy>.up.railway.app
export OLLAMA_API_KEY=<bearer-secret>
bash scripts/keep-ollama-warm.sh
```

Uso en cron (cada 5 min):

```cron
*/5 * * * * OLLAMA_HOST=https://... OLLAMA_API_KEY=... \
            /path/to/scripts/keep-ollama-warm.sh >> /var/log/ollama-warm.log 2>&1
```

O como long-running daemon:

```bash
INTERVAL_SECONDS=300 bash scripts/keep-ollama-warm.sh --loop
```

Configuración del cron en Coolify:

- **Coolify → servicio `ai` → Scheduled Task**:
  ```
  */5 * * * *  bash /app/scripts/keep-ollama-warm.sh >> /var/log/keep-warm.log 2>&1
  ```
  (Requiere que el script esté copiado al contenedor — añadirlo al
  `ai/Dockerfile` o montarlo como volumen).

- **GitHub Actions** (cron de GitHub, gratis para repos públicos):
  ```yaml
  # .github/workflows/keep-ollama-warm.yml
  name: Keep Ollama Warm
  on:
    schedule:
      - cron: '*/5 * * * *'
  jobs:
    ping:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - run: |
            bash scripts/keep-ollama-warm.sh
          env:
            OLLAMA_HOST: ${{ secrets.OLLAMA_HOST }}
            OLLAMA_API_KEY: ${{ secrets.OLLAMA_API_KEY }}
  ```

**B. `OLLAMA_KEEP_ALIVE`**:

Ollama mantiene el modelo cargado entre requests. Por defecto son 5 minutos.
Para ENTERAR.ME lo subimos a 24h (o `-1` para siempre):

```dockerfile
# En ai/Dockerfile.ollama
ENV OLLAMA_KEEP_ALIVE=24h
```

Esto hace que Ollama no descargue el modelo de RAM hasta que pase 24h sin
uso. Combinado con el cron ping, el modelo está siempre caliente.

**C. No-sleep en Railway (de pago)**:

En **Settings → Sleep → Disable Sleep**. Solo disponible en planes de
pago. Recomendado para producción.

**D. Warm-up al arrancar el servicio `ai`**:

El `ai/src/index.ts` ya hace `ollamaClient.ensureModel()` al arrancar,
lo que dispara una llamada `chat` mínima que calienta el modelo.

### 6.2 Reintentos en el AI Service

El `ai/src/ollama-client.ts` ya implementa reintentos con backoff
exponencial (configurable vía `OLLAMA_MAX_RETRIES`, default 3). Si el
primer request pilla cold start, reintenta automáticamente.

---

## 7. Cargar el modelo `enterarme-agent`

### 7.1 Modelfile

El archivo `ai/Modelfile` define el modelo custom:

```
FROM qwen2.5:7b-instruct

PARAMETER temperature 0.3
PARAMETER top_p 0.85
PARAMETER num_ctx 8192
PARAMETER stop "<|im_end|>"
PARAMETER stop "</tool_call>"
PARAMETER stop "</tool_response>"

SYSTEM """Eres el Agente IA de ENTERAR.ME, plataforma SaaS multitenant de
control operativo de tareas, materiales y trazabilidad.

IDENTIDAD:
- Tu nombre es ENTERA, agente especializado de ENTERAR.ME.
- Hablas español (es-ES), conciso y operativo. No uses muletillas.
..."""
```

### 7.2 ¿Por qué `qwen2.5:7b-instruct`?

| Modelo                 | Tamaño | RAM   | ES calidad | Tool-calling | Elección |
|------------------------|--------|-------|------------|--------------|----------|
| `qwen2.5:7b-instruct`  | 4.7 GB | 6 GB  | Muy buena  | Sí           | ✅ Default |
| `llama3.1:8b-instruct` | 4.9 GB | 6 GB  | Buena      | Sí           | Alternativa |
| `qwen2.5:3b-instruct`  | 2.0 GB | 3 GB  | Aceptable  | Limitado     | Plan Starter |
| `qwen2.5:14b-instruct` | 8.2 GB | 12 GB | Excelente  | Sí           | Plan Enterprise |

- **Buen balance razonamiento/tamaño** en CPU.
- **Tool-calling nativo** soportado por Ollama (`tools` en `/api/chat`).
- **Soporte de español** robusto (Qwen se entrena con corpus multilingüe).
- `temperature 0.3` para respuestas deterministas (operativo, no creativo).
- `num_ctx 8192` para que el system prompt + historial + RAG quepan.

### 7.3 Cargarlo (Opción A)

Si usaste la **Opción A** (imagen `ollama/ollama` sin Modelfile pre-cargado):

```bash
# Sube el Modelfile al contenedor vía SCP o crea un endpoint temporal
ollama create enterarme-agent -f /root/Modelfile
```

Si usaste la **Opción B** (Dockerfile custom), el entrypoint lo crea
automáticamente en cada arranque.

---

## 8. Cargar el modelo de embeddings

```bash
ollama pull nomic-embed-text
```

Genera vectores de 768 dimensiones. Es el modelo que usa `ai/src/rag/embeddings.ts`:

```typescript
export async function embedText(text: string): Promise<number[]> {
  const truncated = text.length > 4000 ? text.slice(0, 4000) : text;
  return ollamaClient.embed(truncated);
}
```

Verificar:

```bash
curl -X POST https://<tu-caddy>.up.railway.app/api/embeddings \
  -H "Authorization: Bearer $OLLAMA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text","prompt":"hola mundo"}'
# → { "embedding": [0.012, -0.034, ...] } (768 números)
```

---

## 9. Verificación final

```bash
# 1. Lista de modelos cargados
curl https://<tu-caddy>.up.railway.app/api/tags \
  -H "Authorization: Bearer $OLLAMA_API_KEY"
# → {
#     "models": [
#       { "name": "enterarme-agent:latest", "size": 4700000000, ... },
#       { "name": "nomic-embed-text:latest", "size": 274000000, ... },
#       { "name": "qwen2.5:7b-instruct:latest", "size": 4700000000, ... }
#     ]
#   }

# 2. Test de chat
curl -X POST https://<tu-caddy>.up.railway.app/api/chat \
  -H "Authorization: Bearer $OLLAMA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "enterarme-agent",
    "messages": [
      { "role": "user", "content": "¿Quién eres?" }
    ],
    "stream": false
  }'
# → { "message": { "role": "assistant", "content": "Soy ENTERA, agente de ENTERAR.ME..." } }

# 3. Test de embeddings
curl -X POST https://<tu-caddy>.up.railway.app/api/embeddings \
  -H "Authorization: Bearer $OLLAMA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text","prompt":"test de embedding"}'
# → { "embedding": [ ... 768 floats ... ] }
```

---

## 10. Coste estimado en Railway (2025)

| Concepto                        | Coste mensual orientativo                     |
|---------------------------------|-----------------------------------------------|
| Plan Hobby Railway              | 5 USD (incluye 5 USD de usage credit)         |
| Ollama (8 GB RAM / 4 vCPU)      | ~25–30 USD (según uso)                        |
| Caddy proxy (256 MB RAM)        | ~1 USD                                        |
| Disco para modelos (~5 GB)      | ~0.50 USD                                     |
| **Total aproximado**            | **30–35 USD/mes**                             |

Alternativa más barata para staging: usar `qwen2.5:3b-instruct` (2 GB RAM)
→ ~10 USD/mes. Calidad del agente algo peor pero suficiente para demos.

Para producción con mucha carga, migrar a **VPS con GPU**:

| Provider    | Modelo GPU | Coste        | Tokens/seg |
|-------------|------------|--------------|------------|
| Hetzner CCX | —          | ~30 USD/mes  | 5–15 (CPU) |
| Hetzner GPU | RTX 4000   | ~80 USD/mes  | 50–80      |
| GCP L4      | Nvidia L4  | ~120 USD/mes | 80–120     |
| RunPod      | RTX 4090   | ~0.5 USD/h   | 100–150    |

---

## 11. Conectar desde ENTERAR.ME

En el servicio `ai` (Coolify), ajusta estas variables:

```env
OLLAMA_HOST=https://<tu-caddy>.up.railway.app
OLLAMA_API_KEY=<bearer-secret-del-proxy>
OLLAMA_MODEL=enterarme-agent
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_TIMEOUT_MS=120000
OLLAMA_MAX_RETRIES=3
```

Y prueba conectividad desde dentro del contenedor `ai`:

```bash
# Entra al contenedor ai (Coolify → servicio ai → Exec)
curl -sS https://$OLLAMA_HOST/api/tags \
  -H "Authorization: Bearer $OLLAMA_API_KEY"
```

También desde el AI Service:

```bash
curl https://ai.enterarme.me/health
# → { "status": "ok", "checks": { "db": true, "ollama": true }, "ollama_model": "enterarme-agent" }
```

Si `ollama: false` en el healthcheck:

1. Verifica que las variables `OLLAMA_HOST` y `OLLAMA_API_KEY` están bien
   en Coolify.
2. Verifica que el servicio Caddy en Railway está corriendo.
3. Verifica que el modelo `enterarme-agent` está cargado (`ollama list`).
4. Revisa logs del `ai` (pino) para ver el error exacto.

---

## 12. Troubleshooting

| Síntoma                                | Causa probable                          | Fix                                                              |
|----------------------------------------|-----------------------------------------|------------------------------------------------------------------|
| 401 desde el servicio `ai`             | API key mal configurada                 | Revisa `OLLAMA_API_KEY` en Coolify y en Caddy Railway            |
| `model not found`                      | No se hizo `ollama create`              | Rehacer paso 7 (Opción A) o redeploy (Opción B)                  |
| Respuestas lentas (>30s)               | RAM insuficiente                        | Subir a 8 GB RAM / 4 vCPU                                        |
| `context length exceeded`              | `num_ctx` demasiado pequeño             | Subir `PARAMETER num_ctx` en `Modelfile` (máx 32768)             |
| Embeddings 0-d o error de dimensión    | Modelo de embed no descargado           | `ollama pull nomic-embed-text`                                   |
| Embeddings con dimensión != 768        | Modelo de embed equivocado              | Usar siempre `nomic-embed-text` (768-d). No mezclar con otros.   |
| Tool-calling no funciona               | Modelo no lo soporta                    | Usar `qwen2.5:7b-instruct` o `llama3.1:8b-instruct`              |
| Ollama cae cada X minutos              | Railway sleep                           | Activar Disable Sleep o montar cron ping (sección 6)             |
| `OOMKilled` en logs                    | RAM insuficiente                        | Subir plan o usar modelo más pequeño (`qwen2.5:3b`)              |

---

## 13. Mantenimiento

### 13.1 Actualizar el Modelfile

1. Edita `ai/Modelfile` en el repo.
2. Si usas **Opción B** (Dockerfile custom): push a `main` → Railway
   redeployea → el entrypoint recrea el modelo automáticamente.
3. Si usas **Opción A**: sube el nuevo Modelfile al contenedor y ejecuta
   `ollama create enterarme-agent -f /root/Modelfile` manualmente.

### 13.2 Cambiar de modelo base

1. Edita `FROM qwen2.5:7b-instruct` en `ai/Modelfile`.
2. Si el nuevo modelo no está descargado, añádelo al `entrypoint.sh`:
   ```bash
   ollama pull <nuevo-modelo>
   ```
3. Redeploy.

### 13.3 Limpiar modelos antiguos

```bash
ollama list
ollama rm <modelo-viejo>
```

### 13.4 Backup de la config

El `Modelfile` vive en el repo (versionado). No es necesario backup del
volumen Railway (los modelos se re-descargan).

---

## 14. Referencias

- `ai/Modelfile` — definición del modelo `enterarme-agent`.
- `ai/ollama-railway.md` — guía original del agente 2-b (más corta).
- `ai/src/ollama-client.ts` — wrapper con reintentos y auth bearer.
- `ai/src/rag/embeddings.ts` — uso del modelo de embeddings.
- `ai/src/config.ts` — variables de entorno validadas con zod.
- `.env.example` — todas las variables OLLAMA_*.
- `scripts/keep-ollama-warm.sh` — script de cron para evitar cold start.
- `scripts/load-ollama-model.sh` — script que carga los modelos Ollama
  (pull base + create custom) en un host remoto.
- Ollama docs: https://ollama.com
- Railway docs: https://docs.railway.app
