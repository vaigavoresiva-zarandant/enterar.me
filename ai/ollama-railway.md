# Desplegar Ollama en Railway para ENTERAR.ME

Guía paso a paso para tener Ollama ejecutándose en Railway y consumiéndolo
desde el servicio `ai` de ENTERAR.ME.

> ⚠️ Ollama no soporta auth nativo. Para exponerlo en Railway necesitas un
> proxy delante (Caddy/nginx/Cloudflare Access) que añada la API key. Ver
> sección **Seguridad**.

---

## 0. Requisitos

- Cuenta en Railway (https://railway.app)
- Docker (opcional, para pruebas locales del Modelfile)
- El archivo `Modelfile` de este repositorio

---

## 1. Crear proyecto en Railway

1. Entra en https://railway.app → **New Project** → **Deploy from GitHub repo**
   (o **Empty project** si vas a usar imagen Docker Hub).
2. Llama al proyecto `enterarme-ollama`.

---

## 2. Opción A: usar la imagen oficial `ollama/ollama`

1. **New → Docker Image** → busca `ollama/ollama:latest`.
2. Renombra el servicio a `ollama`.
3. En **Settings → Networking → Generate Domain** crea una URL pública
   (p.ej. `enterarme-ollama.up.railway.app`).
4. **Añade un volumen** (Settings → Volumes → Add Volume):
   - Mount path: `/root/.ollama`
   - Esto persiste los modelos entre deploys.
5. Variables de entorno:
   ```
   OLLAMA_HOST=0.0.0.0:11434
   OLLAMA_ORIGINS=*
   ```
6. En **Settings → Resources** sube CPU/RAM (mínimo 4 GB RAM, 2 vCPU;
   recomendado 8 GB RAM / 4 vCPU para `qwen2.5:7b-instruct`).

> Railway no soporta GPUs todavía. Para producción con mayor carga, considera
> un VPS en Hetzner/OVH con GPU y ejecutar Ollama allí. Esta guía sirve para
> staging y cargas medias.

---

## 3. Opción B: imagen custom con el Modelfile precargado

Evita tener que hacer `ollama create` manualmente tras cada cold start.

1. Entra al servicio `ollama` en Railway → **Settings → Source** → cambia a
   "GitHub repo" y conecta este repo (carpeta `ai/`).
2. Railway usará este `Dockerfile.ollama` (créalo a mano si no existe):

   ```dockerfile
   FROM ollama/ollama:latest

   COPY Modelfile /root/Modelfile
   COPY entrypoint.sh /entrypoint.sh
   RUN chmod +x /entrypoint.sh

   ENV OLLAMA_HOST=0.0.0.0:11434

   ENTRYPOINT ["/entrypoint.sh"]
   ```

   `entrypoint.sh`:
   ```bash
   #!/bin/sh
   set -e
   ollama serve &
   SERVER_PID=$!
   # Esperar a que arranque
   until ollama list >/dev/null 2>&1; do sleep 1; done
   # Pre-pull base + crear modelo custom
   ollama pull qwen2.5:7b-instruct
   ollama pull nomic-embed-text
   ollama create enterarme-agent -f /root/Modelfile || true
   wait $SERVER_PID
   ```

3. Ajusta la variable de entorno `OLLAMA_MODEL=enterarme-agent` en el
   servicio `ai` de ENTERAR.ME.

---

## 4. Seguridad: proxy con API key

Ollama no trae auth. Tienes dos opciones:

### 4.1 Proxy Caddy (recomendado)

Crea otro servicio Railway con imagen `caddy:2-alpine` y este `Caddyfile`:

```caddyfile
:80 {
  @auth not header Authorization "Bearer $OLLAMA_API_KEY"
  respond @auth 401

  reverse_proxy ollama.internal:11434
}
```

Variables:
- `OLLAMA_API_KEY=genera-un-secreto-largo`

Exponer este servicio en vez del `ollama` directo. En el servicio `ai`:
- `OLLAMA_HOST=https://tu-caddy.up.railway.app`
- `OLLAMA_API_KEY=<la-misma-key>`

### 4.2 Cloudflare Access / Tunnel

Si ya usas Cloudflare, crea un Tunnel y protege con Access (Zero Trust).
El servicio `ai` mandará el token de servicio como bearer.

---

## 5. Cargar el modelo `enterarme-agent` (opción A)

Si usaste la **Opción A** (imagen `ollama/ollama` sin Modelfile pre-cargado):

1. Abre una shell en Railway (servicio `ollama` → **Settings → Railway CLI**
   o usa el panel web de ejecutivos):

   ```bash
   ollama pull qwen2.5:7b-instruct
   ollama pull nomic-embed-text
   ```

2. Copia el `Modelfile` al contenedor (o crea un endpoint temporal que lo
   haga) y ejecuta:

   ```bash
   ollama create enterarme-agent -f /root/Modelfile
   ```

3. Verifica:

   ```bash
   ollama list
   # debe mostrar:
   #   enterarme-agent:latest
   #   nomic-embed-text:latest
   #   qwen2.5:7b-instruct:latest
   ```

---

## 6. Configurar el servicio `ai` de ENTERAR.ME

En el servicio `ai` (Coolify o Railway), ajusta estas variables de entorno:

```
OLLAMA_HOST=https://<tu-proxy-ollama>.up.railway.app
OLLAMA_API_KEY=<bearer-secret-del-proxy>
OLLAMA_MODEL=enterarme-agent
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_TIMEOUT_MS=120000
OLLAMA_MAX_RETRIES=3
```

Y comprueba conectividad:

```bash
curl https://<host>/api/tags \
  -H "Authorization: Bearer $OLLAMA_API_KEY"
```

---

## 7. Cold start y cómo mantenerlo caliente

Railway suspende servicios inactivos. El primer request puede tardar 10–60 s.

Estrategias:

1. **Healthcheck proactivo**: el servicio `ai` ya hace `ensureModel` al arrancar
   y cada request reintenta 3 veces (ver `ollama-client.ts`).
2. **Cron ping**: crea un flow en Directus o un cron en Coolify que llame a
   `GET https://<host>/api/tags` cada 4 minutos. Mantiene el contenedor vivo.
3. **No-sleep en Railway** (de pago): en **Settings → Sleep → Disable Sleep**.
4. **Warm-up en arranque del servicio ai**: tras `assertDbConnection`, lanza un
   `ollama.chat` vacío (ya lo hace `ensureModel` indirectamente).

---

## 8. Troubleshooting

| Síntoma | Causa probable | Fix |
|--------|----------------|-----|
| 401 desde el servicio ai | API key mal configurada | Revisa `OLLAMA_API_KEY` en ambos lados |
| `model not found` | No se hizo `ollama create` | Rehacer paso 5 |
| Respuestas lentas (>30s) | RAM insuficiente | Subir a 8 GB RAM / 4 vCPU |
| `context length exceeded` | num_ctx demasiado pequeño | Subir `PARAMETER num_ctx` en `Modelfile` |
| Embeddings 0-d | modelo de embed no descargado | `ollama pull nomic-embed-text` |

---

## 9. Costes orientativos (2025)

- Railway Hobby (5 USD/mes + uso): ~4 GB RAM ≈ 25–30 USD/mes
- CPU-only con `qwen2.5:7b`: ~5–15 tokens/seg
- Recomendación: empezar con Railway para staging, migrar a VPS con GPU
  (Hetzner CCX o GCP L4) para producción.

---

Última actualización: Task 2-b — Servicio IA Ollama.
