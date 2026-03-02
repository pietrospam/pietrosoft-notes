# REQ-012: Floating Action Button (FAB)

**Estado:** PENDIENTE  
**Prioridad:** Media  
**Fecha:** 2026-02-27

Este requerimiento introduce un botón de acción flotante (FAB, por sus siglas
inglesas) en la interfaz principal de la aplicación. La idea proviene de muchos
sistemas móviles y de escritorio donde un botón con el símbolo “+” ofrece un
punto único para iniciar tareas de creación. El FAB debe ser accesible desde
cualquier vista principal y agilizar el flujo de trabajo.

## Objetivo
Agregar un elemento visual persistente que permita al usuario crear rápidamente
datos o ejecutar acciones frecuentes sin navegar por menús o pestañas.

## Especificaciones
1. **Posicionamiento y apariencia**
   - El FAB debe mostrarse en la esquina inferior derecha de la ventana (18px
de margen desde los bordes) y seguir las pautas de diseño actuales (círculo
azul/verde/tema con icono blanco “+”).
   - Debe mantenerse sobre el resto del contenido, sin afectar el desplazamiento.
   - Al hacer hover (desktop) o al mantenerlo presionado (móvil) debe
     mostrar una sombra/destello para indicar interactividad.

2. **Acciones principales**
   El FAB abre un pequeño menú radial o desplegable con los siguientes
   elementos **ordenados de arriba hacia abajo:**
   1. **Nuevo TimeSheet** (icono ⏱️ en naranja) – abre el `TimeSheetModal` en modo
      creación sin necesidad de seleccionar una tarea previa.
   2. **Nueva tarea** (📋 azul) – abre el modal de creación de nota de tipo *task*.
   3. **Nueva conexión** (👥 verde) – abre el modal de creación de nota de tipo *connection*.
   4. **Nueva nota general** (📄 gris) – abre el modal de creación de nota de tipo *general*.
   5. *Separador*
   6. **Nuevo cliente** (👥 gris) – abre `ClientsManager` en modo creación.
   7. **Nuevo proyecto** (📁 gris) – abre `ProjectsManager` en modo creación.
   8. *Separador*
   9. **Configuración** (⚙️ gris) – salta directamente al panel de preferencias/configuración.

   Los colores de los iconos replican la simbología utilizada en las listas y
   vistas existentes (task=azul, connection=verde, timesheet=naranja, etc.),
   facilitando la identificación visual.

3. **Acciones adicionales sugeridas**


## Requisitos de edición de notas TASK

- En cualquier lugar donde se muestre o seleccione una tarea (tarjetas, editor inline o popup, dropdowns, etc.), si el campo "Ticket/Fase" tiene valor el texto visible debe usar el formato `#<número> <descripción corta>` en vez del título simple; usar el título cuando no haya ticket.
   Estas operaciones podrían añadirse si resultan útiles (la mayoría ya forman
   parte de las acciones principales):
   - **Importar/Exportar** – enlaces a las funciones de backup, útiles para
     usuarios intensivos.
   - Puede considerarse añadir en el futuro atajos de colaboración/chat o
     cualquier otro comando frecuente que aparezca.

4. **Comportamiento**
   - El menú se cierra automáticamente al hacer clic fuera o seleccionar una
     opción.
   - En dispositivos móviles, el FAB debe responder al gesto de pulsación larga
     mostrando el menú.
   - Si el usuario tiene filtros activos (por ejemplo, cliente seleccionado), el
     FAB no debe perder esas condiciones al crear una entidad relacionada.
   - El menú debe ser navegarle con teclado (tab/enter/escape) y
     soportar lectores de pantalla (aria labels).

5. **Persistencia y personalización**
   - Guardar en localStorage si el usuario ha desactivado el FAB (por accesibilidad),
     o la posición (si permitimos arrastrarlo en el futuro).
   - Opción en preferencias para elegir si el FAB aparece siempre, solo en
     vista `bitacora`, o nunca.

6. **Documentación y pruebas**
   - Actualizar especificaciones de UI (`SPEC-002-ui-skeleton.md`) con el FAB.
   - Añadir sección en `REQ-010` o crear un documento propio (este archivo) que
     describa la interacción.
   - Escribir pruebas e2e que verifiquen las acciones de creación desde el FAB
     y su correcta desaparición cuando se cierra el menú.

## Notas adicionales
- El FAB debe dejar espacio suficiente para no tapar elementos críticos como el
  selector de fechas en `TimeSheetView` o botones de export/import.
- Diseñar el componente de forma que pueda reutilizarse en otras vistas (por
  ejemplo, un conjunto de atajos convivientes).
- Si en el futuro se añade colaboración o chat, el FAB podría también incluir
  acciones relacionadas (nuevo mensaje, nueva nota compartida, etc.).

Este documento define los requisitos iniciales; la implementación se realizará
una vez aprobada la especificación y tras finalizar el trabajo en los cambios
anteriores (navegación/tab, timesheets).