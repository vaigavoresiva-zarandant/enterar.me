# Branding — ENTERAR.ME

Manual de marca de **ENTERAR.ME**: logo, paleta, tipografía, wordmark,
variantes, normativas de uso y ficheros disponibles.

> Ficheros en `docs/branding/`. NO modificar ni renombrar.

---

## 1. Identidad

**ENTERAR.ME** es una plataforma SaaS multitenant de control operativo de
tareas, materiales y trazabilidad. La marca transmite:

- **Solidez operativa** (gris base, formas cuadradas).
- **Energía / acción** (rojo del punto y el triángulo).
- **Versatilidad modular** (tres barras horizontales en colores complementarios).
- **Claridad tipográfica** (sans-serif geométrica, sin adornos).

El wordmark **`ENTERAR.ME`** siempre se escribe:

- En mayúsculas: `ENTERAR.ME`.
- Con el punto rojo entre `ENTERAR` y `ME`.
- Sin espacios: `ENTERAR.ME` (no `ENTERAR . ME`).

> En el logo SVG, el punto rojo del wordmark es una forma circular llena
> en color rojo `#f64151` — referencia visual al triángulo superior
> derecho del icono.

---

## 2. Paleta

Paleta de 5 colores, todos con hex exacto. No usar otros colores fuera
de esta paleta (excepto grises intermedios derivados de `#333`).

| Color      | Hex       | RGB             | Uso principal                                                |
|------------|-----------|-----------------|--------------------------------------------------------------|
| Gris base  | `#333333` | rgb(51,51,51)   | Tipografía principal, fondos oscuros, iconos.                |
| Rojo       | `#f64151` | rgb(246,65,81)  | Acento principal, punto del wordmark, CTAs críticos.         |
| Amarillo   | `#fcbf28` | rgb(252,191,40) | Avisos, badges de estado, highlighting.                      |
| Púrpura    | `#4c2eec` | rgb(76,46,236)  | Marca de agua, enlaces activos, selección de navegación.     |
| Teal       | `#1cddbe` | rgb(28,221,190) | Estados de éxito, badges de plan Pro, indicadores positivos. |

### 2.1 Aplicación en Tailwind

Los frontends (`apps/super-admin` y `apps/tenant-admin`) definen la paleta
como colores `brand-*` en `tailwind.config.ts`:

```typescript
// tailwind.config.ts
colors: {
  brand: {
    gray: '#333333',
    red: '#f64151',
    yellow: '#fcbf28',
    purple: '#4c2eec',
    teal: '#1cddbe',
  }
}
```

Uso: `bg-brand-red`, `text-brand-purple`, `border-brand-teal`, etc.

### 2.2 Reglas de contraste

| Combinación                       | Contraste | Apto para            |
|-----------------------------------|-----------|----------------------|
| Gris `#333` sobre blanco          | 12.6:1    | Texto principal.     |
| Blanco sobre gris `#333`          | 12.6:1    | Modo oscuro.         |
| Rojo `#f64151` sobre blanco       | 3.4:1     | Texto grande, CTAs.  |
| Blanco sobre rojo `#f64151`       | 3.4:1     | Botones primary.     |
| Púrpura `#4c2eec` sobre blanco    | 7.2:1     | Texto normal.        |
| Teal `#1cddbe` sobre blanco       | 1.7:1     | Decoración solo.     |

> **Regla estricta**: NO usar indigo ni blue como colores principales. La
> paleta de ENTERAR.ME no los incluye y rompería la coherencia visual.

---

## 3. Tipografía

### 3.1 Familia principal

Sans-serif geométrica estilo **Montserrat** o **Helvetica Neue**. En los
frontends se carga Inter (variable, con fallback):

```css
font-family: 'Inter', 'Helvetica Neue', 'Montserrat', system-ui, -apple-system, sans-serif;
```

### 3.2 Familia monoespaciada

Para código, IDs y datos técnicos: **JetBrains Mono** (cargada en el
super-admin) o `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.

### 3.3 Escala tipográfica

| Nivel       | Tamaño | Peso      | Uso                                |
|-------------|--------|-----------|------------------------------------|
| Display     | 48 px  | 700       | Login, hero.                       |
| H1          | 32 px  | 700       | Títulos de página.                 |
| H2          | 24 px  | 600       | Secciones.                         |
| H3          | 20 px  | 600       | Subsecciones.                      |
| Body large  | 18 px  | 400       | Texto destacado.                   |
| Body        | 16 px  | 400       | Texto base.                        |
| Small       | 14 px  | 400       | Etiquetas, helper text.            |
| Caption     | 12 px  | 500       | Breadcrumbs, timestamps.           |
| Mono small  | 13 px  | 500       | IDs, código inline.                |

### 3.4 Peso y estilo

- Pesos disponibles: 400 (regular), 500 (medium), 600 (semibold), 700 (bold).
- No usar cursivas salvo en citas textuales.
- `letter-spacing`: 0 por defecto, `0.05em` en mayúsculas pequeñas (badges).

---

## 4. Logo

### 4.1 Construcción

El logo se compone de dos partes:

1. **Icono (cuadrado 888×888 en el viewBox original)**:
   - Cuadrado gris `#333` con un recorte en la esquina superior derecha.
   - En ese recorte, un triángulo rojo `#f64151` (movimiento, acción).
   - Tres barras horizontales en el interior:
     - Amarilla `#fcbf28` (corta, 356 px).
     - Teal `#1cddbe` (media, 326 px).
     - Púrpura `#4c2eec` (larga, 468 px).
   - Juntas representan la versatilidad modular de la plataforma
     (operativa + analítica + IA).

2. **Wordmark** `ENTERAR.ME`:
   - Tipografía sans-serif geométrica, peso semibold/bold.
   - El punto entre `ENTERAR` y `ME` es un círculo rojo `#f64151`.
   - Tamaño relativo al icono: la altura del wordmark es ~35% de la del icono.

### 4.2 Ficheros disponibles

| Fichero                       | Formato | Uso recomendado                              |
|-------------------------------|---------|----------------------------------------------|
| `docs/branding/logo.svg`      | SVG     | Web, app, documentos digitales. Escalable.   |
| `docs/branding/logo-v6.pdf`   | PDF v6  | impresión, documentos físicos, presentaciones.|

> El SVG es la fuente de verdad. El PDF v6 es la versión para impresión
> (alta resolución, fuentes embebidas).

El mismo SVG está copiado en:

- `apps/super-admin/public/logo.svg`
- `apps/tenant-admin/public/logo.svg`

Para servirlo como asset estático en los frontends.

---

## 5. Cuándo usar solo el icono vs el wordmark completo

### 5.1 Solo icono (cuadrado)

Usar **solo el icono** cuando:

- El espacio es pequeño (< 48×48 px): favicon, avatar, app icon.
- La marca ya está visible cerca (footer, header con nombre textual).
- En badges compactos (skill badges, badges de plan).

Ejemplos:

- Favicon del navegador.
- Avatar del usuario en el header.
- App icon en móvil.
- Marca de agua pequeña en esquinas.

### 5.2 Wordmark completo (icono + texto)

Usar **icono + wordmark** cuando:

- Es la primera impresión de la marca (login, landing, email header).
- Hay espacio horizontal suficiente (> 200 px de ancho).
- En el sidebar del panel (acompañado del icono).
- En documentación oficial, contratos, presentaciones a clientes.

Ejemplos:

- Pantalla de login (`apps/super-admin/src/app/(auth)/login/page.tsx`).
- Sidebar del panel (`apps/super-admin/src/components/layout/sidebar.tsx`).
- Firma de emails.
- Cabecera de PDFs (informes).

### 5.3 Solo wordmark (texto)

Excepcionalmente, cuando el icono ya está cerca y el espacio es
estrictamente tipográfico: títulos de documentos, menciones en texto.
El punto rojo debe mantenerse siempre.

---

## 6. Variantes

### 6.1 Color (default)

- Icono: con los 5 colores de la paleta.
- Wordmark: gris `#333` con punto rojo `#f64151`.

Uso: sobre fondo blanco o claro (`#f8fafc`, `#ffffff`).

### 6.2 Monocromo (negro)

- Icono: todo en gris `#333` (incluidas las barras y el triángulo).
- Wordmark: gris `#333` con punto también gris.

Uso: fondos con mucho ruido visual, documentos en blanco y negro,
impresión monocromo.

### 6.3 Monocromo (blanco)

- Icono: todo en blanco `#ffffff`.
- Wordmark: blanco con punto en rojo `#f64151` (mantener el acento) o
  todo blanco si el contexto lo requiere.

Uso: sobre fondos oscuros (`#333`, `#1a1a1a`, fotos). Modo oscuro del panel.

### 6.4 Sobre fondo claro

- Usar variante a color o monocromo negro.
- Asegurar contraste mínimo 4.5:1.
- Padding alrededor: 1× la altura del icono (ver sección 7).

### 6.5 Sobre fondo oscuro

- Usar variante monocromo blanco.
- Mantener el punto rojo como acento si el contraste lo permite.
- Sobre fotos con mucho ruido, añadir un overlay gris `#333` al 70% detrás.

---

## 7. Mínimos y espacio de protección

### 7.1 Tamaño mínimo

| Variante             | Mínimo absoluto | Recomendado |
|----------------------|-----------------|-------------|
| Solo icono           | 24×24 px        | 32×32 px    |
| Icono + wordmark     | 120×32 px       | 180×48 px   |
| Wordmark solo        | 100×20 px       | 140×28 px   |

> Por debajo del mínimo absoluto, el logo pierde legibilidad (sobre todo
> las tres barras internas del icono).

### 7.2 Espacio de protección (clear space)

El logo necesita un margen libre alrededor equivalente a **la altura del
triángulo rojo** del icono (aproximadamente 1/4 de la altura total del
icono).

```
┌─────────────────────────────────────┐
│                                     │
│    [margen = altura triángulo]      │
│                                     │
│    ┌─────────┐  E N T E R A R . M E │
│    │ ICONO   │                      │
│    │ 888×888 │                      │
│    └─────────┘                      │
│                                     │
│    [margen = altura triángulo]      │
│                                     │
└─────────────────────────────────────┘
```

En ese margen no debe haber ningún otro elemento gráfico, texto o borde.

### 7.3 Background

- **Blanco o gris muy claro** (`#f8fafc`): usar logo a color o monocromo negro.
- **Color de marca (rojo, amarillo, púrpura, teal)**: usar logo monocromo blanco.
- **Fotografías**: añadir overlay o usar caja blanca con padding.

---

## 8. Usos incorrectos

Está **prohibido**:

1. **Cambiar la paleta**: no usar indigo, blue, verde fuera del teal, etc.
2. **Deformar el logo**: mantener siempre la proporción (escalar uniformemente).
3. **Rotar el logo**: el icono va siempre vertical, sin tilt.
4. **Añadir sombras o efectos**: el logo es plano, sin drop-shadow, sin
   gradientes, sin glow.
5. **Cambiar la tipografía del wordmark**: la geometría de las letras es
   parte de la marca.
6. **Recortar el icono**: siempre se ve completo, no se puede cortar una
   esquina.
7. **Poner el logo sobre fondos con bajo contraste** (rojo sobre rojo, etc.).
8. **Usar el punto del wordmark en otro color que no sea rojo `#f64151`**.

---

## 9. Wordmark en CSS

Los frontends implementan el wordmark como clase CSS en `globals.css`:

```css
.wordmark {
  font-family: 'Inter', 'Helvetica Neue', sans-serif;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #333333;
}
.wordmark .dot {
  color: #f64151;
}

/* Modo oscuro */
.dark .wordmark {
  color: #ffffff;
}
.dark .wordmark .dot {
  color: #f64151;
}
```

Uso en JSX:

```tsx
<span className="wordmark">ENTERAR<span className="dot">.</span>ME</span>
```

Componente React en `apps/super-admin/src/components/branding/wordmark.tsx`
y `apps/tenant-admin/src/components/layout/logo.tsx` (este último incluye
el icono SVG inline + el wordmark).

---

## 10. Icono en SVG (extraído del logo)

Para usar solo el icono (sin wordmark), recortar el SVG al viewBox
`0 0 888 888`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 888 888">
  <defs>
    <style>
      .cls-1{fill:#f64151;}
      .cls-2{fill:#333;}
      .cls-3{fill:#fcbf28;}
      .cls-4{fill:#4c2eec;}
      .cls-5{fill:#1cddbe;}
    </style>
  </defs>
  <!-- Triángulo rojo superior derecho -->
  <polygon class="cls-1" points="567.92 0 678.92 111 777 111 777 209.08 888 320.08 888 0 567.92 0"/>
  <!-- Marco gris con recorte -->
  <polygon class="cls-2" points="777 777 111 777 111 111 535.94 111 424.94 0 0 0 0 888 888 888 888 463.06 777 352.06 777 777"/>
  <!-- Tres barras internas -->
  <rect class="cls-3" x="211.5" y="209" width="356" height="111"/>
  <rect class="cls-5" x="211.5" y="389" width="326" height="111"/>
  <rect class="cls-4" x="211.5" y="568" width="468" height="111"/>
</svg>
```

---

## 11. LogoMark en React

El tenant-admin tiene un componente `LogoMark` en
`apps/tenant-admin/src/components/layout/logo.tsx` que renderiza el icono
inline (SVG) + el wordmark, con variantes de tamaño:

```tsx
<LogoMark size="sm" />      // 24px
<LogoMark size="md" />      // 32px (default)
<LogoMark size="lg" />      // 48px
<LogoMark size="xl" />      // 64px (login)
<LogoMark showText={true} /> // icono + wordmark
<LogoMark showText={false} /> // solo icono
```

---

## 12. Favicon

Generado a partir del icono cuadrado (solo la parte del icono, sin wordmark):

- `apps/super-admin/src/app/favicon.ico` (default Next.js).
- `apps/tenant-admin/src/app/favicon.ico`.

> **Trabajo futuro**: generar favicons multi-tamaño (16, 32, 48, 192, 512)
> y `apple-touch-icon` a partir del SVG del icono.

---

## 13. Plantillas y mockups

### 13.1 Header de emails

```
┌─────────────────────────────────────────────────┐
│  [ICONO]  ENTERAR.ME                            │
│                                                 │
│  Hola María,                                    │
│                                                 │
│  Tu tarea "Limpieza semanal" ha sido completada.│
│  ...                                            │
└─────────────────────────────────────────────────┘
```

- Icono a 32×32 px.
- Wordmark en sans-serif bold, color `#333`.
- Fondo blanco, padding 24 px.

### 13.2 PDF de informe

- Cabecera: logo a color (icono + wordmark) a la izquierda, datos del
  tenant a la derecha.
- Pie: "Generado por ENTERAR.ME — https://enterarme.me" en gris `#666`.
- Tipografía: Inter o equivalente.

### 13.3 Tarjetas de presentación

- Fondo gris `#333` o blanco.
- Logo a color en el anverso, en monocromo blanco en el reverso (si es
  gris oscuro).

---

## 14. Accesibilidad

- **Contraste**: todas las combinaciones de la tabla 2.2 son AA o AAA.
- **Texto alternativo**: en el frontend, el SVG del logo lleva
  `aria-label="ENTERAR.ME — Inicio"` y `role="img"`.
- **No depende solo del color**: los estados (pendiente, completada) usan
  iconos además de color.
- `prefers-reduced-motion`: las animaciones del panel se desactivan
  automáticamente (Framer Motion lo respeta).

---

## 15. Ficheros disponibles en `docs/branding/`

| Fichero           | Tamaño  | Formato | Descripción                                   |
|-------------------|---------|---------|-----------------------------------------------|
| `logo.svg`        | 4.5 KB  | SVG     | Logo completo (icono + wordmark) vectorial.   |
| `logo-v6.pdf`     | 350 KB  | PDF v6  | Logo completo en alta resolución, imprimible. |

> Estos son los **únicos** ficheros canónicos. Cualquier derivado
> (favicon, app icon, social card) debe generarse a partir de ellos y
> almacenarse en `public/` de la app correspondiente.

---

## 16. Referencias

- `docs/branding/logo.svg` — fuente de verdad del logo.
- `docs/branding/logo-v6.pdf` — versión imprimible.
- `apps/super-admin/public/logo.svg` — copia para el frontend super-admin.
- `apps/tenant-admin/public/logo.svg` — copia para el frontend tenant-admin.
- `apps/super-admin/src/components/branding/wordmark.tsx` — componente Wordmark.
- `apps/tenant-admin/src/components/layout/logo.tsx` — componente LogoMark.
- `apps/super-admin/src/app/globals.css` — clase `.wordmark` con punto rojo.
- `apps/super-admin/tailwind.config.ts` y `apps/tenant-admin/tailwind.config.ts` —
  definición de la paleta `brand-*`.
