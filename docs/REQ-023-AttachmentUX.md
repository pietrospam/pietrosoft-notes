# REQ-023: Mejoras UX de Anexos

## Descripción General

Mejoras en la experiencia de usuario del sistema de anexos (attachments) para permitir carga múltiple de archivos, mejor visualización de nombres y iconos contextuales según el tipo de archivo.

## Funcionalidades Solicitadas

### 1. Carga Múltiple de Archivos

#### Estado Actual
- El selector de archivos solo permite seleccionar 1 archivo a la vez
- El drag & drop ya soporta múltiples archivos pero con UX mejorable

#### Requerimiento
- Permitir selección múltiple de archivos desde el diálogo de archivo
- Mantener soporte de drag & drop para múltiples archivos
- Mostrar progreso de carga cuando hay múltiples archivos en cola

### 2. Visualización de Nombres de Archivo

#### Estado Actual
- Los nombres de archivo se truncan con ellipsis (`truncate` class)
- No se puede ver el nombre completo sin hover o descarga

#### Requerimiento
- Mostrar el nombre completo del archivo
- Permitir word-wrap/saltos de línea para nombres largos
- Mantener legibilidad sin romper el diseño del panel

### 3. Iconos por Tipo de Archivo

#### Estado Actual
- Solo 3 iconos: Imagen, PDF/documento, y genérico (File)
- No diferencia entre tipos específicos de archivo

#### Requerimiento
- Iconos específicos para categorías de archivos comunes:
  - Imágenes (jpg, png, gif, webp, svg)
  - Documentos PDF
  - Documentos Word (doc, docx)
  - Hojas de cálculo Excel (xls, xlsx)
  - Presentaciones (ppt, pptx)
  - Archivos de texto (txt, md)
  - Archivos comprimidos (zip, rar, 7z, tar, gz)
  - Audio (mp3, wav, ogg)
  - Video (mp4, avi, mov, webm)
  - Código fuente (js, ts, py, java, etc.)
  - Icono genérico para tipos no reconocidos

### 4. Botón de Preview Condicional

#### Estado Actual
- El botón de preview (ojo) siempre se muestra para todos los archivos
- Al hacer click en archivos no soportados, la preview falla o muestra contenido inútil

#### Requerimiento
- Solo mostrar el botón de preview para tipos de archivo con preview soportada:
  - Imágenes: jpg, jpeg, png, gif, webp, svg
  - PDF (si está implementado viewer)
  - Texto plano: txt, md, json, xml
  - Código fuente (text/*)
- Ocultar o deshabilitar preview para:
  - Documentos Office (docx, xlsx, pptx)
  - Archivos comprimidos
  - Binarios
  - Audio/Video sin reproductor implementado

## Criterios de Aceptación

- [ ] **AC1:** El usuario puede seleccionar múltiples archivos desde el diálogo de archivos
- [ ] **AC2:** Al subir múltiples archivos, se muestra indicador de progreso (X de Y)
- [ ] **AC3:** Los nombres de archivos largos se muestran completos con word-wrap
- [ ] **AC4:** Cada tipo de archivo muestra un icono representativo
- [ ] **AC5:** El botón de preview solo aparece para tipos de archivo con soporte
- [ ] **AC6:** El drag & drop de múltiples archivos funciona correctamente

## Archivos Afectados

| Archivo | Cambios |
|---------|---------|
| `AttachmentsPanel.tsx` | Multi-select, iconos, preview condicional |
| `AttachmentsModal.tsx` | Posibles ajustes de layout |
| Posible nuevo archivo de utilidades para mapeo de extensiones |

## Prioridad

Media - Mejora de UX sin impacto funcional crítico

## Referencias

- SPEC-010: Mejoras UX de Anexos (especificación técnica)
- SPEC-004: Sistema de Attachments (original)
