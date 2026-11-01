# Locos API — Backend ultraligero

Backend funcional con **Node.js nativo**, sin bibliotecas externas, sin bases de datos y sin procesos de fondo. Diseñado para subir a GitHub y ejecutar como **un único Web Service en Render**. Es un proyecto **independiente de Hikari API**.

## ¿Qué hace ya?

- Sirve la página web desde `public/`.
- Expone endpoints JSON en `/api`.
- Tiene comprobación de estado (`/healthz`) para Render.
- Incluye un límite básico de peticiones por IP (120 por minuto de forma predeterminada).
- Valida el JSON en el ejemplo POST y limita el tamaño de entrada a 16 KB.
- No utiliza base de datos, paquetes npm ni claves API por ahora.

## Endpoints de ejemplo

| Método | Ruta | Resultado |
|---|---|---|
| GET | `/` | Página diseñada por tu amigo |
| GET | `/healthz` | Estado del servidor |
| GET | `/api` o `/api/docs` | Lista de endpoints en JSON |
| GET | `/api/v1/ping` | Respuesta `pong` |
| GET | `/api/v1/info` | Versión y tiempo encendido |
| POST | `/api/v1/echo` | Devuelve el campo `message` enviado en JSON |

Prueba del POST:

```bash
curl -X POST http://localhost:10000/api/v1/echo \
  -H "Content-Type: application/json" \
  -d '{"message":"hola"}'
```

## Ejecutar en PC

Usá Node.js 22 o superior.

```bash
npm start
```

Abrí `http://localhost:10000/`. No hace falta ejecutar `npm install` para el proyecto actual.

Probá las rutas mediante:

```bash
npm test
```

## Subir a GitHub y Render

1. Subí todo el contenido de esta carpeta a la **raíz** del repositorio GitHub. Conservá `render.yaml`, `package.json`, `src/`, `server.js` y `public/`.
2. En Render, creá un **Web Service** (no Static Site), vinculá tu repositorio y seleccioná plan Free si lo necesitás.
3. Render puede usar el `render.yaml` desde **Blueprints**. Si configurás un Web Service manualmente, seleccioná runtime Node, **Build Command:** `npm install --omit=dev`, **Start Command:** `npm start`, **Health Check Path:** `/healthz`.
4. Esperá a que Render muestre el servicio desplegado y comprobá la URL `.onrender.com` antes de configurar el dominio.
5. Para `locos-api.duckdns.org`: añadí el subdominio en Render → Settings → Custom Domains. La verificación depende de que DuckDNS permita el tipo de registro que Render indique; **no está garantizada**. No asumas que el enlace funciona solo por haber creado el nombre en DuckDNS.

El servidor escucha automáticamente el puerto indicado por `PORT` y la interfaz `0.0.0.0`, necesarios para Render.

## Integrar la web de tu amigo

Tu amigo puede actualizar **solo** `public/index.html` y agregar sus archivos CSS, JS, imágenes y carpetas dentro de `public/`. El servidor ya entrega archivos estáticos. Las peticiones desde esa misma web a `/api/v1/...` comparten dominio y no necesitan CORS.

Ejemplo desde su JavaScript:

```js
const response = await fetch('/api/v1/ping');
const data = await response.json();
console.log(data.message); // pong
```

**No modifiques** `src/app.js` salvo para agregar nuevos endpoints. Si la web del amigo es un proyecto con compilación (React/Vite), habrá que adaptar la ruta de archivos y el build cuando comparta su repositorio.

## Agregar un endpoint nuevo

En `src/app.js`, dentro de la función que atiende las solicitudes y antes del bloque `if (path === '/api' || path.startsWith('/api/'))`, agregá por ejemplo:

```js
if (method === 'GET' && path === '/api/v1/saludo') {
  return sendJson(res, 200, { ok: true, message: '¡Hola desde Locos API!' });
}
```

A continuación añadí la ruta a la lista de `/api/docs`.

## Variables de entorno

- `PORT`: Render asigna el puerto automáticamente; en local usa `10000`.
- `RATE_LIMIT_PER_MINUTE`: por defecto `120` solicitudes por IP y minuto en `/api/v1/`.

**Importante:** el límite de peticiones es un mecanismo sencillo en memoria; no sustituye las protecciones de infraestructura y no se comparte entre instancias. Detrás de Render se toma la IP de `X-Forwarded-For`, que solo es fiable cuando se recibe desde un proxy confiable. La API de ejemplo no requiere autenticación: no añadas endpoints privados hasta implementar autorización.

## Archivos

```
locos-api/
├── public/index.html       # Web actual de tu amigo
├── src/app.js              # Endpoints y servicio estático
├── server.js               # Arranque en Render
├── test/app.test.js        # Pruebas automáticas
├── package.json            # Sin dependencias
├── render.yaml             # Configuración opcional con Blueprint
└── README.md
```

El backend base está listo, pero aún falta definir **qué funciones reales ofrecerá la API**; los endpoints incluidos son demostrativos.

## Nota de seguridad sobre el registro de la web actual

La web incluida tiene formularios de registro/inicio de sesión **solo demostrativos**: guardan correo, usuario y contraseña en `localStorage` del navegador, sin validación en el servidor. Esto no crea cuentas reales, no sirve entre dispositivos y no es seguro para contraseñas reales. **No lo promocionen como sistema de cuentas ni pidan contraseñas reales** hasta implementar backend de autenticación, hash de contraseñas y almacenamiento persistente seguro.
