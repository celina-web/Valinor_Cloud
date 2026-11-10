# Refactor: rediseño del frontend con Tailwind 4

Este documento detalla el rediseño visual de las vistas Pug de TurnoFlex: qué se pidió, qué decisiones se tomaron, qué archivos cambiaron y cómo se verificó que la aplicación siga funcionando igual.

---

## 1. Motivación

Las vistas usaban una hoja de estilos genérica (`src/public/estilos.css`): navbar azul con links en línea, tablas con bordes, formularios a una columna de ancho fijo y casi nada de responsive. Se pidió:

- Integrar **Tailwind CSS 4 por CDN** y que aplique a todas las vistas.
- Una **paleta de colores para los estados de los turnos** y un fondo neutro que no compita con ellos.
- **Navbar** con logo a la izquierda y avatar con iniciales a la derecha (con menú flotante y cierre de sesión).
- **Sidebar** a la izquierda con menú hamburguesa para expandir/contraer, en tono pastel.
- **Footer** con el año en curso calculado.
- **Login** dentro de una tarjeta con el logo centrado.
- **Formularios de alta a 2 columnas** en desktop (máximo 1440px).
- **Responsive** para móviles, tablets, portátiles y escritorio.
- **Página de error** mínima: logo, nombre, botón para volver al inicio y footer.
- Usar clases de Tailwind siempre que sea posible y escribir CSS propio solo si algo no se puede resolver con Tailwind.

## 2. Resumen antes / después

| Aspecto | Antes | Ahora |
|---|---|---|
| Estilos | `src/public/estilos.css` (281 líneas de CSS a mano) | Tailwind 4 por CDN; **no queda CSS propio** (el archivo se eliminó) |
| Configuración visual | Colores repetidos en el CSS | Tokens en `@theme` (`src/views/includes/tema.pug`), una sola fuente de verdad |
| Plantillas | Un `layout.pug` para todo | `layouts/base.pug` (esqueleto + footer) y `layout.pug` (shell con navbar + sidebar) |
| Componentes de vista | Marcado repetido en cada página | Mixins Pug (`includes/mixins.pug`): campos, tablas, modales, alertas, íconos, logo |
| Navegación | Links en una barra horizontal | Sidebar colapsable (riel de íconos en desktop, drawer en móvil/tablet) |
| Usuario conectado | Texto "nombre (rol)" + botón Salir | Avatar con iniciales y menú flotante con datos del usuario y "Cerrar sesión" |
| Formularios de alta | Una columna, `max-width: 400px` por campo | Grilla de 2 columnas desde 1024px, contenedor de hasta 1440px |
| Tablas | Ancho completo, se desbordaban en móvil | Scroll horizontal dentro de su propio contenedor; la página nunca scrollea en horizontal. Borde fino negro debajo del encabezado y entre filas (no debajo de la última) |
| Tipografía | Arial | Poppins (Google Fonts) en todas las vistas |
| Estados de turnos | Azul/verde/rojo de Bootstrap | Paleta pedida, etiquetas con texto oscuro y franja de color por fila |
| Página de error | Título, mensaje y link dentro del layout con navbar | Logo + "TurnoFlex" + botón "Volver al inicio" + footer |

Lo que **no** cambió: el backend (modelos, controladores, API, permisos, reglas de negocio), el flujo de datos (Pug renderiza el esqueleto y el JS del navegador carga los datos desde `/api/...`) y todos los `id`, `name` y clases de los que depende el JS.

## 3. Decisiones de diseño

### 3.1 Tailwind 4 por CDN

Se usa el build de navegador oficial, con versión exacta fijada:

```pug
script(src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3")
```

Este build compila las clases en el navegador y **observa el DOM**, así que también estiliza las filas, botones y etiquetas que el JS crea dinámicamente (no hace falta "safelist" ni paso de build). Se eligió 4.3.3 (julio 2026) en lugar de la última publicada para no depender de una versión de pocos días.

> Nota: el build de navegador es la opción recomendada por Tailwind para prototipos y apps internas sin build. Si en el futuro se quiere evitar la compilación en el cliente, se puede migrar a `@tailwindcss/cli` reutilizando el mismo bloque `@theme` sin tocar las vistas.

### 3.2 Configuración: `src/views/includes/tema.pug`

Un `style(type="text/tailwindcss")` incluido en el `<head>` con tres partes:

**`@theme` — tokens de color y tipografía**

| Token | Valor | Uso |
|---|---|---|
| `--color-fondo` | `#F8F9FA` | Fondo general de la app |
| `--color-pie` | `#DEE2E6` | Footer (dos tonos más arriba que el fondo en la escala de grises: `#F8F9FA` → `#E9ECEF` → `#DEE2E6`) |
| `--color-lavanda-50…300` | `#F3F1FA`, `#E6E3F3`, `#D4CFEA`, `#BEB6DE` | Navbar y sidebar (`100`), bordes y hover (`200`/`300`) |
| `--color-indigo-profundo` | `#2E2A5A` | Texto sobre lavanda |
| `--color-marca` | `#4C3F91` | Logo, avatar, anillos de foco |
| `--color-turno-presente` | `#4F772D` | Verde oliva: presente / en sala de espera |
| `--color-turno-pendiente` | `#E9C46A` | Amarillo mostaza: pendiente de confirmación |
| `--color-turno-confirmado` | `#1D3557` | Azul cobalto: seña pagada / confirmado |
| `--color-turno-cancelado` | `#E63946` | Coral: cancelado / ausente sin aviso |
| `--color-turno-finalizado` | `#E5E5E5` | Gris claro: turno finalizado |
| `--font-sans` | Poppins + fallback de sistema | Tipografía (Poppins se carga de Google Fonts, pesos 400 a 700) |

De las alternativas propuestas se eligieron el mostaza `#E9C46A` (el `#E29578` es más salmón que mostaza) y el coral `#E63946` (resalta más rápido el bache libre).

**Variantes custom**

```css
@custom-variant colapsada (&:where([data-sidebar="colapsada"] *));
@custom-variant drawer-abierto (&:where([data-drawer="abierto"] *));
```

Permiten escribir el estado de la sidebar como clases (`lg:colapsada:w-18`, `max-lg:drawer-abierto:translate-x-0`) en vez de manipular estilos desde JS: el JS solo cambia un atributo `data-*` en `<html>`.

**`@layer components` — solo lo que comparten Pug y el JS**

Los botones, etiquetas y filas que crea el JS del navegador (`crearBoton`, `crearEtiqueta`, `crearFilaTurno`) ya usaban nombres de clase (`btn-editar`, `btn-danger`, `estado-reservado`…). En lugar de repartir largas cadenas de utilidades por el JS, esas clases se redefinieron con `@apply` de utilidades de Tailwind. Es la única "capa de componentes"; todo lo demás son utilidades escritas directamente en Pug.

| Clase | Aspecto |
|---|---|
| `.btn`, `.btn-chico` | Base de botón (forma, foco, disabled) y tamaño compacto para tablas |
| `.btn-primario` | Azul cobalto con texto blanco (contraste alto, no es un pastel) |
| `.btn-secundario` | Blanco con borde gris |
| `.btn-editar` | Mostaza con texto oscuro |
| `.btn-atender` | Verde oliva con texto blanco |
| `.btn-cancelar`, `.btn-danger` | Coral suave con texto rojo oscuro |
| `.etiqueta` | Pill con punto de color |
| `.estado-reservado` / `-atendido` / `-cancelado` | Estados de turno con fondo sólido del color de la paleta (ver 3.3) |
| `.estado-presente` / `-pendiente` | Listos para cuando existan esos estados |
| `.etiqueta-info` / `-exito` / `-peligro` / `-neutra` | Etiquetas genéricas (rol, estado de usuario, acciones de auditoría) |
| `.fila-reservado` / `-atendido` / `-cancelado` | Franja izquierda de 4px con el color del estado en las filas de turnos |

### 3.3 Estados de turnos y contraste

El modelo `Turno` tiene tres estados (`reservado`, `atendido`, `cancelado`). Se acordó **no tocar el backend** y mapearlos a la paleta:

| Estado del modelo | Color | Significado en la paleta | Tratamiento |
|---|---|---|---|
| `reservado` | Azul cobalto | Confirmado | Etiqueta con fondo cobalto `#1D3557` y texto blanco; franja cobalto |
| `atendido` | Gris claro | Finalizado | Etiqueta con fondo gris `#E5E5E5` y texto gris oscuro; fila con fondo gris (queda "archivada" visualmente) |
| `cancelado` | Coral | Cancelado / no-show | Etiqueta con fondo coral `#E63946` y texto casi negro; fila con tinte coral para que el bache resalte |

Presente (oliva) y Pendiente (mostaza) quedan definidos como tokens y clases (`.estado-presente`, `.estado-pendiente`) para cuando se agreguen esos estados al modelo.

Las etiquetas de estado de turno tienen **fondo sólido con el color de la paleta**, para que los estados se distingan a simple vista (en una primera versión tenían un fondo tenue y el color solo en el texto, y costaba diferenciarlos).

Regla de contraste: **nunca texto blanco sobre fondos pastel o claros**. El texto blanco solo va sobre colores oscuros: cobalto (contraste ≈ 12:1), oliva (≈ 5,3:1) y `marca`. Sobre gris, mostaza y coral el texto es oscuro: en el coral `#E63946` el texto casi negro da ≈ 5:1, mientras que el blanco daría ≈ 4,2:1, por debajo del mínimo AA para texto chico. El nombre del cliente se muestra siempre en `font-medium text-gray-900`.

Las etiquetas genéricas (`.etiqueta-info`, `-exito`, `-peligro`, `-neutra`), que se usan para el rol, el estado de los usuarios y las acciones de auditoría, mantienen el fondo tenue con texto oscuro para no competir visualmente con los estados de los turnos.

### 3.4 Estructura de plantillas

```
src/views/
├── layouts/base.pug        # doctype, <head> (Tailwind, tema, fuente), <body>, footer, api.js
├── layout.pug              # extiende base: navbar + sidebar + <main> (páginas logueadas)
├── includes/
│   ├── tema.pug            # @theme, variantes y componentes de Tailwind
│   ├── mixins.pug          # componentes de vista
│   ├── navbar.pug
│   ├── sidebar.pug
│   └── footer.pug
├── login.pug               # extiende layouts/base (sin shell)
├── error.pug               # extiende layouts/base (sin shell)
└── home.pug, clientes/, profesionales/, turnos/, usuarios/, auditoria/   # extienden layout
```

`layout.pug` mantiene su nombre, así las vistas de módulos siguen con `extends ../layout` y el cambio es transparente para ellas. Los bloques son: `titulo` (contenido de `<title>`), `cuerpo` (lo define `layout.pug`, `login.pug` y `error.pug`), `content` (lo definen las vistas de módulos) y `scripts`.

### 3.5 Mixins (`src/views/includes/mixins.pug`)

| Mixin | Qué genera |
|---|---|
| `+icono(nombre)` | SVG inline (trazos estilo Lucide): calendario, inicio, clientes, profesionales, usuarios, auditoria, menu, cerrar, salir, reloj, atendido, cancelado, mas, guardar, filtro. Acepta atributos (`+icono("menu")(class="size-6")`) |
| `+logo(tamanio)` | Baldosa color `marca` con el ícono de calendario con check; `"grande"` para login y error |
| `+encabezado(titulo, descripcion)` | `h1` de la página con descripción y bloque opcional |
| `+seccion(titulo, descripcion)` | Tarjeta blanca redondeada que agrupa un bloque |
| `+campo(id, etiqueta, opciones)` | `label` + `input`; los atributos van al input. Si es `required` muestra un asterisco coral (salvo `sinMarca`); `contenedor` agrega clases al wrapper (p. ej. `lg:col-span-2`) |
| `+campoSelect(id, etiqueta, opciones)` | Igual que `campo` pero con `select` y las `option` como bloque |
| `+botonera` | Fila de botones al pie de un formulario en grilla (`col-span-full`) |
| `+alerta(id)` | Caja de error `hidden role="alert"` que el JS maneja con `mostrarError()` |
| `+tabla(columnas, idTbody)` | Tabla con encabezados, scroll horizontal propio y `tbody` vacío para el JS |
| `+vacio(id, texto)` | Mensaje de listado vacío |
| `+modal(id, titulo)` | Modal de edición (overlay + panel con scroll) controlado por el atributo `hidden` |
| `+tarjetaResumen(id, texto, icono, variante)` | Tarjeta del panel con la cantidad de turnos por estado |
| `+enlaceSidebar(href, texto, icono, activo)` | Link de la sidebar con `aria-current="page"` y tooltip (`title`) |

### 3.6 Navbar

- Barra `sticky` de 64px en lavanda pastel con borde inferior.
- Izquierda: botón hamburguesa (`#btnSidebar`), logo y "TurnoFlex" (link al inicio).
- Derecha: avatar circular (`#btnMenuUsuario`) con las **iniciales** calculadas en Pug a partir de `usuario.nombre` (primera letra del primer y último nombre; si es una sola palabra, sus dos primeras letras).
- Al hacer click se abre `#menuUsuario`: avatar, nombre, `@usuario`, etiqueta con el rol y botón **"Cerrar sesión"**. Ese botón conserva `id="btnLogout"`, así sigue usando el handler existente de `src/public/js/api.js`. El menú se cierra con click afuera o Escape y actualiza `aria-expanded`.

### 3.7 Sidebar

- Ítems con ícono, filtrados por permiso como antes (`puede(...)`): Inicio, Turnos, Clientes, Profesionales y una sección "Administración" con Usuarios y Auditoría.
- **Ítem activo**: se marca con `aria-current="page"` y se estiliza con la variante `aria-[current=page]:` de Tailwind. Para saber la ruta en Pug se agregó en `src/index.js` un middleware que expone `res.locals.rutaActual = req.path`.
- **Desktop (≥ 1024px)**: columna de 256px que ocupa todo el alto; el menú interno es `sticky` y acompaña el scroll. La hamburguesa la contrae a un **riel de 72px** con solo íconos (las etiquetas pasan a `sr-only` y cada link tiene `title` como tooltip). El estado se guarda en `localStorage` (`turnoflex:sidebar`) y un script inline en el `<head>` lo aplica antes de pintar para evitar el parpadeo.
- **Móvil y tablet (< 1024px)**: drawer que entra desde la izquierda sobre un overlay oscuro, con su propia cabecera (logo + botón cerrar). Se cierra con el overlay, con Escape, con el botón cerrar o al elegir un link. Mientras está cerrado es `invisible`, así no recibe foco con Tab.

### 3.8 `src/public/js/layout.js` (nuevo)

Script vanilla, envuelto en una IIFE para no chocar con las globales de `api.js`:

- Decide el comportamiento de la hamburguesa con `matchMedia("(min-width: 64rem)")` (el mismo breakpoint `lg` de Tailwind): en desktop alterna `data-sidebar="colapsada"` y lo persiste; en móvil alterna `data-drawer="abierto"`.
- Al pasar a desktop cierra el drawer.
- Abre y cierra el menú del usuario, mueve el foco y mantiene `aria-expanded`.
- El acceso a `localStorage` está en `try/catch` (modo privado o almacenamiento bloqueado no rompe nada; simplemente no se recuerda la preferencia).

### 3.9 Footer

`includes/footer.pug`, incluido en `layouts/base.pug`, así aparece en **todas** las vistas (también login y error). Fondo `#DEE2E6`, alineado a la izquierda:

```
2026 | TurnoFlex Sistema de Turnos | Desarrollado por Valinor Cloud
```

El año sale de `new Date().getFullYear()` en cada render del servidor, por lo que cambia solo con el año. Los separadores son `aria-hidden` y el contenido hace wrap en pantallas chicas.

### 3.10 Login

Tarjeta blanca `rounded-2xl` centrada vertical y horizontalmente (ancho máximo 384px), con el **logo grande centrado** sobre "TurnoFlex", el subtítulo, los campos y el botón "Ingresar" a ancho completo. Se conservan `#formLogin`, `#errorLogin` y los ids `usuario`/`password`.

### 3.11 Página de error

Solo muestra el logo centrado, "TurnoFlex" y el botón **"Volver al inicio"** (`href="/"`, el panel principal), más el footer. No tiene navbar ni sidebar. El `titulo` que envía el servidor ("Página no encontrada", "Acceso denegado"…) se usa en el `<title>` de la pestaña y, junto con el mensaje, en un texto `sr-only` para lectores de pantalla; no se muestra visualmente, como se pidió.

### 3.12 Formularios y responsive

- **Formularios de alta** (turno, cliente, profesional, usuario): `grid grid-cols-1 lg:grid-cols-2`, es decir 1 columna hasta 1023px y **2 columnas desde 1024px** (portátiles y escritorio). El contenido de la página está limitado a `max-w-[1440px]`. Los botones van al pie, alineados a la derecha.
- **Modales de edición**: misma grilla, 2 columnas desde 768px y ancho máximo de 672px.
- **Filtros** (turnos y auditoría): apilados en móvil, en fila desde 640px.
- **Breakpoints**: los de Tailwind 4 coinciden exactamente con los pedidos, por lo que no se redefinieron:

| Rango pedido | Prefijo Tailwind |
|---|---|
| Móviles 320–639px | (sin prefijo) |
| Móviles grandes ≥ 640px | `sm:` |
| Tablets ≥ 768px | `md:` |
| Portátiles ≥ 1024px | `lg:` |
| Escritorio ≥ 1280px | `xl:` |

### 3.13 Tipografía y separadores de tablas

- **Fuente Poppins** en todas las vistas: se carga desde Google Fonts en `layouts/base.pug` (pesos 400, 500, 600 y 700) y se asigna en `--font-sans` del `@theme`. Como el `<body>` usa `font-sans`, aplica a toda la app, incluidos login y error.
- **Bordes entre filas**: el mixin `+tabla` usa `divide-y divide-black` en el `<tbody>`, que dibuja un borde negro de 1px entre filas consecutivas; la última fila no lleva borde inferior (el contenedor redondeado ya cierra la tabla). El `<thead>` tiene `border-b border-black` para separar el encabezado de la primera fila. Como el borde se aplica al `<tbody>`, también alcanza a las filas que crea el JS.

### 3.14 Ajustes en el JS del navegador

Cambios mínimos, sin tocar la lógica:

| Archivo | Cambio |
|---|---|
| `src/public/js/api.js` | `crearBoton` antepone `btn btn-chico` a la clase recibida; la celda de acciones de `crearFila` usa `whitespace-nowrap space-x-2` en lugar de la clase `acciones` |
| `src/public/js/turnosTabla.js` | Agrega `fila-<estado>` a cada fila y muestra el nombre del cliente con `textoDestacado()` (texto oscuro y en negrita media) |
| `src/public/js/usuarios.js` | `estadoDe` usa `etiqueta-exito` (activo) y `etiqueta-peligro` (inactivo/vencido) en lugar de reutilizar `estado-*` |
| `src/public/js/auditoria.js` | `claseDeAccion` usa `etiqueta-peligro` (accesos denegados, logins fallidos, sesiones revocadas), `etiqueta-info` (login/logout) y `etiqueta-exito` (el resto) |
| `src/public/js/layout.js` | Nuevo (ver 3.8) |

Las clases `estado-*` quedan reservadas a los turnos.

## 4. Archivos

**Nuevos**

- `src/views/layouts/base.pug`
- `src/views/includes/tema.pug`
- `src/views/includes/mixins.pug`
- `src/views/includes/navbar.pug`
- `src/views/includes/sidebar.pug`
- `src/views/includes/footer.pug`
- `src/public/js/layout.js`
- `docs/refactor-frontend.md` (este documento)

**Reescritos**

- `src/views/layout.pug`, `login.pug`, `error.pug`, `home.pug`
- `src/views/turnos/index.pug`, `clientes/index.pug`, `profesionales/index.pug`, `usuarios/index.pug`, `auditoria/index.pug`

**Editados**

- `src/public/js/api.js`, `turnosTabla.js`, `usuarios.js`, `auditoria.js`
- `src/index.js` (middleware `res.locals.rutaActual`)
- `CLAUDE.md` (sección Arquitectura)
- `README.md` (descripción, estructura del proyecto, "Cómo funciona", declaración de uso de IA y bibliografía; se quitó `estilos.css`)

**Eliminado**

- `src/public/estilos.css`: todas sus reglas se reemplazaron con utilidades de Tailwind (el preflight de Tailwind ya incluye `[hidden] { display: none !important }`, que era la única regla "estructural"). No hizo falta CSS propio.

## 5. Ids y clases preservados

Para que el JS existente siga funcionando sin cambios de lógica, todas las vistas conservan: `formAlta`, `formEditar`, `formFiltros`, `formLogin`, `errorAlta`, `errorListado`, `errorEdicion`, `errorTurnos`, `errorAuditoria`, `errorLogin`, `modalEditar`, `.btn-cerrar-modal`, `tablaTurnos`, `tablaClientes`, `tablaProfesionales`, `tablaUsuarios`, `tablaAuditoria`, `sinRegistros`, `sinTurnos`, `btnLimpiarFiltros`, `cantidadReservados`, `cantidadAtendidos`, `cantidadCancelados`, `.select-rol`, `.select-profesional`, `name="activo"`, `btnLogout`, y los `data-rol`, `data-usuario-id` y `data-permisos` del `<body>`.

## 6. Verificación

Se probó contra la app corriendo en Docker (`docker compose up`) con los datos del seed:

1. **Render del servidor**: todas las vistas responden 200 logueado como admin (`/`, `/turnos`, `/clientes`, `/profesionales`, `/usuarios`, `/auditoria`), `/login` responde 200 y una ruta inexistente responde 404 con la nueva página de error. `/estilos.css` ya no existe.
2. **Navegador headless (Chromium)** a 320, 768, 1024 y 1440px en todas las vistas: sin errores de consola ni de página y **sin scroll horizontal** en ningún caso (las tablas scrollean dentro de su contenedor).
3. **Sidebar**: en 1440px la hamburguesa la contrae a riel de íconos y el estado persiste al recargar; en 375px abre el drawer y se cierra al tocar el overlay. El ítem activo se marca en cada módulo.
4. **Menú de usuario**: muestra iniciales, nombre, usuario y rol; "Cerrar sesión" desloguea y redirige a `/login`.
5. **CRUD**: alta de un cliente desde el formulario y baja desde la tabla funcionan; los botones y etiquetas creados por el JS toman los estilos nuevos.
6. **Permisos**: con `profesional1` la sidebar muestra solo Inicio, Turnos, Clientes y Profesionales, y `/usuarios` muestra la página de error con título "Acceso denegado · TurnoFlex".
7. **Footer** con el año en curso en todas las vistas, incluidas login y error.

Para repetir la verificación a mano:

```bash
docker compose up --build -V
docker compose exec app npm run seed
# abrir http://localhost:3000 y probar con admin/admin123, recepcion/recepcion123 y profesional1/prof1234
# usar el modo responsive de DevTools en 320, 375, 768, 1024, 1280 y 1440px
```
