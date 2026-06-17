# Scripts — ENTERAR.ME

Utilidades bash para arrancar, inicializar y operar ENTERAR.ME en local y en producción (Coolify).

Todos los scripts:

- Tienen shebang `#!/usr/bin/env bash` y `set -euo pipefail`.
- Cargan automáticamente `../.env` si existe (no hace falta exportar a mano).
- Usan colores cuando se ejecutan en TTY.
- Verifican dependencias (`curl`, `jq`, `docker`) antes de empezar.
- Aceptan overrides vía variables de entorno con defaults razonables.

## Listado

| Script                  | Qué hace                                                                                              | Cuándo usarlo                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `init-directus.sh`      | Espera a Directus, aplica schema snapshot, importa 3 seeds, crea token de servicio, imprime resumen. | Tras el primer arranque de Directus (local o Coolify).              |
| `seed-marketplace.sh`   | Re-importa solo `planes.json` y `marketplace-sectores.json`.                                          | Tras editar esos seeds (sin tocar el superadmin).                   |
| `create-superadmin.sh`  | Asegura que el user admin@enterarme.me existe con rol super-admin y crea token de servicio.           | Si el superadmin no se creó bien en el primer init.                 |
| `create-tenant.sh`      | Llama al endpoint `POST /onboarding/tenant` con todos los argumentos.                                | Para crear tenants de prueba o dar de alta un cliente desde CLI.    |
| `keep-ollama-warm.sh`   | Ping a `OLLAMA_HOST/api/tags` y calienta el modelo. Modo `--loop` o single-shot.                      | En cron (Railway free tier duerme tras ~5 min sin tráfico).         |
| `load-ollama-model.sh`  | `ollama pull` de los modelos base + `ollama create enterarme-agent -f ai/Modelfile`.                  | Tras desplegar Ollama en Railway (o local) la primera vez.          |
| `dev-up.sh`             | `docker compose up -d` + wait Directus + `init-directus.sh`.                                          | Para levantar el entorno de desarrollo local en 1 comando.          |
| `dev-down.sh`           | `docker compose down -v` (o `--keep-volumes` para conservar datos).                                   | Para parar el entorno dev.                                          |

## Uso típico (local dev)

```bash
# 1. Configura tu .env
cp .env.example .env
# edita .env: cambia todos los "cambia-esta-..." por valores reales

# 2. Levanta todo
bash scripts/dev-up.sh

# 3. (opcional) Carga el modelo en Ollama (necesitas Ollama local o Railway)
OLLAMA_HOST=http://localhost:11434 bash scripts/load-ollama-model.sh

# 4. Crea un tenant de prueba
bash scripts/create-tenant.sh \
  --name "Mi Empresa Demo" \
  --slug mi-empresa-demo \
  --plan Pro \
  --email admin@demo.com \
  --password "Demo12345!"

# 5. Cuando acabes
bash scripts/dev-down.sh
```

## Uso típico (Coolify / producción)

Despliegas los servicios vía Coolify (ver `coolify/README.md`). Para inicializar Directus desde tu portátil apuntando al Directus de Coolify:

```bash
DIRECTUS_URL=https://api.enterarme.me \
DIRECTUS_ADMIN_EMAIL=admin@enterarme.me \
DIRECTUS_ADMIN_PASSWORD=<tu-password> \
USE_DOCKER=0 \
bash scripts/init-directus.sh
```

Para crear un tenant nuevo desde CLI:

```bash
DIRECTUS_URL=https://api.enterarme.me \
DIRECTUS_SERVICE_TOKEN=<token-servicio> \
bash scripts/create-tenant.sh \
  --name "Cliente Nuevo" \
  --slug cliente-nuevo \
  --plan Pro \
  --email admin@clientenuevo.com \
  --password "PasswordFuerte123"
```

Para mantener Ollama caliente en cron (Railway):

```bash
# crontab -e
*/5 * * * * OLLAMA_HOST=https://tu-ollama.up.railway.app \
            OLLAMA_API_KEY=<api-key> \
            /path/to/scripts/keep-ollama-warm.sh >> /var/log/ollama-warm.log 2>&1
```

## Dependencias comunes

- **bash** ≥ 4
- **curl**
- **jq**
- **docker** + plugin **docker compose** (solo `dev-up.sh`, `dev-down.sh` y `init-directus.sh` cuando `USE_DOCKER=1`)
- **ollama** CLI (solo `load-ollama-model.sh` cuando `USE_CLI=1`, que es el default si OLLAMA_HOST es localhost)

## Convenciones

- Todos los scripts se ejecutan desde cualquier directorio (resuelven `ROOT_DIR` relativo a `BASH_SOURCE`).
- Cargan `../.env` automáticamente si existe. Puedes sobreescribir cualquier variable con `VAR=valor bash scripts/...`.
- El código de salida es 0 si todo OK, distinto de 0 si algo falla (gracias a `set -euo pipefail`).
- Los tokens/secretos **nunca** se loguean salvo el token de servicio recién creado (que solo se muestra una vez, como hace Directus).

## Troubleshooting rápido

- **`Login fallido` en init-directus.sh**: el admin user no existe todavía. Directus lo crea en el primer arranque con `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Si el contenedor está recién levantado, espera ~30s y reintenta. Si persiste, ejecuta `bash scripts/create-superadmin.sh` después de aplicar el seed `superadmin.json`.
- **`DIRECTUS_SERVICE_TOKEN no definido` en create-tenant.sh**: el endpoint `/onboarding/tenant` está protegido por ese token. Genéralo con `init-directus.sh` o desde el panel Directus → User → Token.
- **`Schema apply falla`**: probablemente Postgres no está listo o el snapshot tiene una colección con dependencia circular. Revisa `docker compose logs directus` y los permisos del rol super-admin.
- **`Create de modelo Ollama falló (HTTP 404)`**: el Modelfile referencia un modelo base que no se ha hecho `pull` antes. El script lo hace automáticamente, pero si tu Ollama está en Railway sin almacenamiento persistente, puede que el `pull` no haya terminado. Reintenta.
- **Cold start del agente IA** la primera llamada tarda 30-60s: programa `keep-ollama-warm.sh` en cron.
