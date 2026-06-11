# Accesos a dashboards por rol

## Objetivo

Permitir que los usuarios con rol de **juez**, **veterinario autorizado** y **director técnico** accedan únicamente al dashboard que les corresponde.

Los roles habilitados para este flujo son:

| Rol | Nombre | Dashboard |
| --- | --- | --- |
| `2` | Juez | Dashboard de juez |
| `3` | Director técnico | Dashboard de director técnico |
| `Z` | Veterinario autorizado | Dashboard de veterinario |

## Reglas de acceso

### Director técnico

- Debe acceder al dashboard de director técnico.
- No debe ver los resultados de la categoría.
- No debe ver la opción **Personas** en el sidebar.

### Juez

- Debe acceder al dashboard de juez.
- Por ahora, solo debe ver el listado de categorías de las ferias en las que participa.
- Debe ingresar desde una PWA responsive.
- El acceso se debe realizar únicamente con un código de acceso.

### Veterinario autorizado

- Debe acceder al dashboard de veterinario.
- Por ahora, solo debe ver el listado de categorías de las ferias en las que participa.
- Debe ingresar desde una PWA responsive.
- El acceso se debe realizar únicamente con un código de acceso.

## Código de acceso

El usuario **ROOT** debe poder asignar un código de acceso de **6 caracteres** a los usuarios de staff desde el apartado **Personas**.

Ese código será usado por jueces y veterinarios autorizados para ingresar a su PWA.

## Catálogo de roles FEDEQUINAS

| id | external_id | source_system | name | type_role | created_at | updated_at |
| --- | --- | --- | --- | --- | --- | --- |
| 20542bf9-f1c5-4ca3-a551-b88d0d3e719f | 0 | FEDEQUINAS | NO VALIDO | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 57cf3dc9-c37f-418e-949b-c0eafc631a93 | 1 | FEDEQUINAS | DIRECTOR GENERAL | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| c03b906c-196a-4440-8c18-27fc86f011b4 | 2 | FEDEQUINAS | JUEZ | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 0d42d6cc-c181-4225-82a8-64a6196ad381 | 3 | FEDEQUINAS | DIRECTOR TÉCNICO | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 04b5a04d-238e-4fad-ad04-f6272dc060e8 | 4 | FEDEQUINAS | ASISTENTE DE PISTA | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| ff942e8a-14b7-4ee0-8bad-5dca0b0411e2 | 5 | FEDEQUINAS | LOCUTOR TÉCNICO | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 9d08efbd-ba8c-4434-8120-33de81111690 | 6 | FEDEQUINAS | JEFE DE ALOJAMIENTO | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| b052890d-2aeb-4150-9e89-ecff046df03a | 7 | FEDEQUINAS | JEFE DE PISTA | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 019861aa-38b9-45cf-9787-c3ca67b5f67f | 8 | FEDEQUINAS | AUXILIARES DE PISTA | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 9fb701c9-1a07-462d-95bc-25394280ede9 | A | FEDEQUINAS | VOCAL 1 | J | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 3d320fd5-8c6e-43b0-9644-6186b3796cb2 | B | FEDEQUINAS | TERCEROS | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| cbf24744-9ee7-4446-8144-ab68b8d8ed45 | C | FEDEQUINAS | ASOCIADOS | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| cf9ebf20-3949-4f2d-b696-7570da0cbcc3 | D | FEDEQUINAS | VEEDOR | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 63f14906-2577-40f1-bbd7-1c73e7639b6d | E | FEDEQUINAS | VOCAL PRINCIPAL | J | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 0823bc5a-be10-4002-aefd-4514e2a787b0 | F | FEDEQUINAS | VOCAL SUPLENTE | J | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| e0f538d2-2df6-4bb7-a488-1f268c2fb58e | G | FEDEQUINAS | REVISOR FISCAL PPAL | J | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 2a2c94c7-eecb-49b2-bd04-8675084bd118 | H | FEDEQUINAS | REVISOR FISCAL SUPLENTE | J | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 6934eee0-ce5a-4d56-bfb2-e5fd7d83045f | I | FEDEQUINAS | INSPECTOR DE APEROS | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 9ffc3831-26ce-49d1-9cd3-4e0f31b78130 | L | FEDEQUINAS | PALAFRENERO | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 1e3f673f-7b4f-4308-bffd-f5d7f6833b4f | M | FEDEQUINAS | MONTADOR | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 31049070-44cc-45ed-ac32-560d58b0c319 | N | FEDEQUINAS | EMPADRONADOR | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 24966ba4-e4bf-483b-a953-228b0136e7bd | P | FEDEQUINAS | PRESIDENTE | J | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| b3b64271-d13a-487d-83c6-657241b114d7 | R | FEDEQUINAS | INSPECTOR DE REGISTROS | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 6242ae0d-eff4-4081-9d81-a5a788863f3d | S | FEDEQUINAS | SECRETARIO | J | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| e484d349-7232-46c3-9759-80b963ff1c68 | T | FEDEQUINAS | TESORERO | J | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| b2ed257a-fdad-4739-b7cd-ee95905800e8 | V | FEDEQUINAS | VICEPRESIDENTE | J | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| a25fc8a0-47bf-4939-a588-746e984b6256 | Y | FEDEQUINAS | DIRECTOR DE CONCURSO | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
| 818ef607-2c74-4e55-8bf8-c11064cb7fd5 | Z | FEDEQUINAS | VETERINARIO AUTORIZADO | D | 2026-06-05 15:10:55.762 | 2026-06-05 15:10:55.762 |
