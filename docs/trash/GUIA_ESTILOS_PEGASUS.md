# Guia de estilos Pegasus

Esta guia define las reglas visuales base para la plataforma Pegasus. El objetivo es mantener una interfaz administrativa sobria, consistente y facil de escanear.

## Principios

- La interfaz debe sentirse operativa, clara y profesional.
- Priorizar lectura rapida, jerarquia visual y acciones predecibles.
- Evitar estilos decorativos que no aporten al flujo de trabajo.
- Mantener componentes simples, reutilizables y con una sola responsabilidad.
- Preferir datos y estados reales sobre textos de relleno.

## Tipografia

- Fuente principal: `Poppins`.
- Usar la misma fuente para titulos, texto de interfaz y numeros.
- Pesos recomendados:
  - `400`: texto normal y descripciones.
  - `500`: labels, items de navegacion y textos de apoyo.
  - `600`: titulos de seccion, metricas y acciones principales.
  - `700`: solo para marca o enfasis puntual.
- No usar letter spacing negativo.
- Usar tracking amplio solo en etiquetas pequenas uppercase, por ejemplo `tracking-[0.16em]`.

## Colores

Los colores base viven en `packages/web/src/app/globals.css`.

### Fondo y superficies

- Fondo general: gris frio claro `#f5f7fb` o token `--background`.
- Superficies principales: blanco `bg-white`.
- Cards y tablas deben tener borde sutil `border-slate-200`.
- Evitar bloques grandes con colores saturados.

### Texto

- Texto principal: `text-slate-950`.
- Texto secundario: `text-slate-600`.
- Texto auxiliar o metadata: `text-slate-500`.
- Texto deshabilitado o placeholder: `text-slate-400`.

### Marca y sidebar

- Sidebar: oscuro, basado en `--sidebar`.
- Texto activo del sidebar: blanco.
- Item activo: `bg-white/12`.
- Hover del sidebar: `bg-white/8`.
- Acento de marca: dorado suave desde `--sidebar-primary`.

### Estados

- Error: rojo suave, por ejemplo `bg-red-50`, `text-red-600`, `border-red-100`.
- Exito: verde suave, por ejemplo `bg-emerald-50`, `text-emerald-600`.
- Advertencia: ambar suave, por ejemplo `bg-amber-50`, `text-amber-600`.
- Informativo: azul suave, por ejemplo `bg-blue-50`, `text-blue-600`.

## Espaciado

- Contenedor de paginas: `max-w-7xl mx-auto`.
- Padding de pagina:
  - Mobile: `px-4 py-6`.
  - Tablet: `md:px-6`.
  - Desktop: `lg:px-8 lg:py-8`.
- Separacion entre secciones: `space-y-6` o `space-y-8`.
- Separacion interna de cards: `p-5` o `p-6`.
- Gaps de grids: `gap-4` para contenido denso, `gap-6` para bloques principales.

## Bordes, radios y sombras

- Radio base: `0.5rem`.
- Cards, inputs y botones: `rounded-lg`.
- Evitar radios excesivamente grandes en UI administrativa.
- Usar sombra solo para elevar superficies importantes:
  - Clase recomendada: `subtle-shadow`.
- No anidar cards dentro de cards.

## Layout

- Sidebar fijo a la izquierda en desktop.
- Header superior sticky con fondo blanco translucido: `bg-white/85 backdrop-blur-md`.
- El header debe contener contexto de la seccion y acciones globales, no informacion repetida.
- La accion global actual es `Cerrar sesion`; no incluir buscador hasta que exista busqueda funcional.
- Las paginas deben empezar con un encabezado claro:
  - Eyebrow opcional.
  - Titulo principal.
  - Descripcion corta si aporta contexto.

## Sidebar

- Mantener navegacion corta y estable.
- Usar icono + texto para cada item.
- Labels en espanol.
- El item activo debe ser evidente pero no estridente.
- El footer del sidebar se reserva para identidad de sesion o estado administrativo.

## Botones

- Accion primaria: fondo oscuro `bg-slate-950`, texto blanco.
- Accion secundaria: `variant="outline"`.
- Botones con iconos deben usar `lucide-react`.
- Si un `Button` renderiza un `Link`, usar:

```tsx
<Button nativeButton={false} render={<Link href="/ruta">Texto</Link>} />
```

- No usar `asChild`; los componentes Base UI del proyecto usan `render`.

## Formularios

- Inputs: `h-12`, `rounded-lg`, borde `border-slate-200`, fondo blanco.
- Labels: `text-sm font-medium text-slate-700`.
- Placeholders: claros y utiles.
- Password inputs deben incluir boton de ojo para mostrar/ocultar.
- Mensajes de error deben mostrar texto legible, nunca objetos crudos.

## Tablas

- Usar tablas para listados densos y comparables.
- Contenedor: `rounded-lg border border-slate-200 bg-white`.
- Header de tabla claro y con labels cortos.
- Filas con informacion principal en `font-medium`.
- Paginar listados largos usando el contrato del backend:

```text
?page=1&limit=20
```

- Mostrar rango y total: `Mostrando 1 - 20 de 100`.

## Cards y metricas

- Cards para metricas deben incluir:
  - Titulo corto.
  - Valor destacado.
  - Descripcion breve.
  - Icono con color suave.
- Evitar cards vacias sin proposito.
- Si una card no tiene datos aun, mostrar un estado vacio claro.

## Iconografia

- Usar `lucide-react`.
- Tamano base: `size-4` en navegacion y botones pequenos.
- Tamano destacado: `size-5` en cards y estados.
- No crear SVG manual si existe un icono lucide equivalente.

## Implementacion

- Mantener componentes con responsabilidad unica.
- Extraer componentes cuando haya repeticion real o una pieza tenga comportamiento propio.
- Mantener tipos locales simples para DTOs consumidos por una sola pantalla.
- Evitar `any`; definir tipos minimos con los campos usados por la vista.
- No hacer formateo de datos directamente repetido en JSX; extraer funciones pequenas como `formatDate`.
- Usar el contrato real del backend antes de inventar transformaciones del lado cliente.

## Checklist antes de cerrar una pantalla

- La pantalla usa Poppins y tokens existentes.
- El layout responde en mobile y desktop.
- No hay textos desbordados ni elementos superpuestos.
- Los botones tienen estados disabled/loading cuando aplica.
- Los listados largos tienen paginacion.
- Los errores se muestran como mensajes legibles.
- ESLint pasa para los archivos modificados.
- TypeScript pasa con `tsc --noEmit` cuando el cambio toca tipos o componentes compartidos.
