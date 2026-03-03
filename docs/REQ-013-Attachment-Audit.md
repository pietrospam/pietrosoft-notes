# REQ-013: Audit Information for Attachments

**Estado:** PENDIENTE  
**Prioridad:** Media  
**Fecha:** 2026-03-03

El sistema actualmente muestra los archivos adjuntos y las imágenes pegadas
desde el portapapeles (capturas de pantalla) en la lista de adjuntos de cada
nota. Este requisito pide un paso adicional: junto al nombre/contador del
anexo debe aparecer también información de auditoría que indique cuándo se
creó ese elemento.

## Objetivo
Permitir al usuario conocer la fecha y hora exactas en las que cada adjunto
fue añadido a la nota, independientemente de que se trate de un fichero
cargado manualmente o de una imagen generada por pegar una captura.

## Especificaciones
1. **Metadatos nuevos**
   - Cada `AttachmentMeta` debe incluir un campo `createdAt` con un valor ISO
     8601 (fecha y hora de creación).
   - El backend debe asignar esta marca temporal al momento de persistir el
     adjunto (actualmente solo se guarda el ID, nombre, tipo, etc.).

2. **Interfaz de usuario**
   - En la lista de adjuntos (`AttachmentsPanel` y `AttachmentViewer`), junto al
     nombre del fichero o la miniatura se mostrará la fecha/hora de creación
     en formato relativo o corto (`Hoy 14:23`, `2026‑03‑01 09:12`, etc.).
   - En el hover/tooltip también se mostrarán los detalles completos.
   - Las pestañas/contadores que indican "X anexos" seguirán existiendo, pero
     al desplegar la lista los metadatos deben ser visibles.
   - No se requiere ordenar por fecha, pero debe preservarse el orden en el que
     los elementos fueron añadidos (es decir, la primera columna puede usar el
     `createdAt` para mantener la cronología). 

3. **Grabación de adjuntos de portapapeles**
   - Las imágenes pegadas desde el clipboard se tratan como anexos normales y
     obtendrán la misma marca de tiempo en el momento de la subida.

4. **Compatibilidad y migración**
   - El campo `createdAt` puede añadirse opcionalmente (nullable) para no romper
     notas existentes. Las notas viejas podrán mostrar "fecha desconocida"
     hasta que se editen o re-suban los adjuntos.
   - Actualizar el repositorio (`notes-repo.ts`) y la API de attachments para
     incluir el nuevo dato en la carga/descarga.

5. **Pruebas y documentación**
   - Añadir casos e2e que verifiquen que los adjuntos recién agregados muestran
     un timestamp y que el valor es correcto.
   - Documentar el cambio en `SPEC-002-ui-skeleton.md` y en el código fuente
     (comentarios o README interno) según corresponda.

## Notas adicionales
- Esta información también será útil para auditoría de cambios y para el
  equipo de soporte.
- El formato de fecha/hora debe respetar las preferencias de localización del
  usuario si estas existen.

Este documento describe el requisito; la implementación quedará para la
siguiente iteración una vez se apruebe y priorice.