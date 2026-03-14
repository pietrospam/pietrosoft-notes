# SPEC-010: Mejoras UX de Anexos

## Resumen

Mejoras en el componente `AttachmentsPanel` para soportar carga múltiple de archivos, visualización completa de nombres, iconos contextuales por tipo de archivo, y botón de preview condicional basado en tipos soportados.

## Requerimientos

- REQ-023: Mejoras UX de Anexos

## Estado: ✅ Completed

---

## 1. Carga Múltiple de Archivos

### 1.1 Cambios en el Input de Archivo

**Ubicación:** `AttachmentsPanel.tsx` línea ~217

**Cambio actual:**
```tsx
<input
  ref={fileInputRef}
  type="file"
  className="hidden"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    e.target.value = '';
  }}
/>
```

**Cambio propuesto:**
```tsx
<input
  ref={fileInputRef}
  type="file"
  multiple
  className="hidden"
  onChange={(e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleMultipleUpload(Array.from(files));
    }
    e.target.value = '';
  }}
/>
```

### 1.2 Función de Carga Múltiple

```tsx
const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

const handleMultipleUpload = async (files: File[]) => {
  if (files.length === 0) return;
  
  setUploadProgress({ current: 0, total: files.length });
  
  for (let i = 0; i < files.length; i++) {
    setUploadProgress({ current: i + 1, total: files.length });
    await handleUpload(files[i]);
  }
  
  setUploadProgress(null);
};
```

### 1.3 Indicador de Progreso

Mostrar en el UI cuando hay uploads en progreso:

```tsx
{uploadProgress && (
  <div className="text-xs text-blue-400 mt-1">
    Subiendo {uploadProgress.current} de {uploadProgress.total}...
  </div>
)}
```

### 1.4 Actualizar Drop Handler

El drop handler actual ya soporta múltiples archivos pero sin indicador de progreso:

```tsx
const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragOver(false);

  const files = Array.from(e.dataTransfer.files);
  if (files.length === 0) return;

  // Usar la misma función de carga múltiple
  await handleMultipleUpload(files);
};
```

---

## 2. Visualización de Nombres Completos

### 2.1 Cambio de Estilos

**Actual (línea ~279):**
```tsx
<p className="text-sm text-gray-300 truncate">{attachment.originalName}</p>
```

**Propuesto:**
```tsx
<p className="text-sm text-gray-300 break-words">{attachment.originalName}</p>
```

### 2.2 Consideraciones de Layout

Para evitar que nombres muy largos rompan el layout:
- Usar `break-words` para permitir saltos en cualquier punto
- Opcionalmente usar `break-all` si se prefiere cortar en cualquier carácter
- Ajustar `min-w-0` en el contenedor padre para permitir el shrink

```tsx
<div className="flex-1 min-w-0 overflow-hidden">
  <p className="text-sm text-gray-300 break-words leading-tight">{attachment.originalName}</p>
  <p className="text-xs text-gray-600">{formatFileSize(attachment.size)}</p>
</div>
```

---

## 3. Iconos por Tipo de Archivo

### 3.1 Crear Utilidad de Mapeo

**Nuevo archivo:** `src/lib/fileIcons.ts`

```typescript
import {
  File,
  FileImage,
  FileText,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  FileCode,
  FileArchive,
  Presentation,
  FileJson,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FileTypeInfo {
  icon: LucideIcon;
  color: string;  // Tailwind color class
}

const extensionMap: Record<string, FileTypeInfo> = {
  // Imágenes
  jpg: { icon: FileImage, color: 'text-green-500' },
  jpeg: { icon: FileImage, color: 'text-green-500' },
  png: { icon: FileImage, color: 'text-green-500' },
  gif: { icon: FileImage, color: 'text-green-500' },
  webp: { icon: FileImage, color: 'text-green-500' },
  svg: { icon: FileImage, color: 'text-green-500' },
  ico: { icon: FileImage, color: 'text-green-500' },
  bmp: { icon: FileImage, color: 'text-green-500' },
  
  // Documentos PDF
  pdf: { icon: FileText, color: 'text-red-500' },
  
  // Documentos Office - Word
  doc: { icon: FileText, color: 'text-blue-500' },
  docx: { icon: FileText, color: 'text-blue-500' },
  odt: { icon: FileText, color: 'text-blue-500' },
  rtf: { icon: FileText, color: 'text-blue-500' },
  
  // Documentos Office - Excel
  xls: { icon: FileSpreadsheet, color: 'text-emerald-500' },
  xlsx: { icon: FileSpreadsheet, color: 'text-emerald-500' },
  ods: { icon: FileSpreadsheet, color: 'text-emerald-500' },
  csv: { icon: FileSpreadsheet, color: 'text-emerald-500' },
  
  // Documentos Office - PowerPoint
  ppt: { icon: Presentation, color: 'text-orange-500' },
  pptx: { icon: Presentation, color: 'text-orange-500' },
  odp: { icon: Presentation, color: 'text-orange-500' },
  
  // Archivos de texto
  txt: { icon: FileText, color: 'text-gray-400' },
  md: { icon: FileText, color: 'text-gray-400' },
  log: { icon: FileText, color: 'text-gray-400' },
  
  // JSON/Config
  json: { icon: FileJson, color: 'text-yellow-500' },
  xml: { icon: FileCode, color: 'text-yellow-500' },
  yaml: { icon: FileCode, color: 'text-yellow-500' },
  yml: { icon: FileCode, color: 'text-yellow-500' },
  toml: { icon: FileCode, color: 'text-yellow-500' },
  
  // Código fuente
  js: { icon: FileCode, color: 'text-yellow-400' },
  ts: { icon: FileCode, color: 'text-blue-400' },
  jsx: { icon: FileCode, color: 'text-cyan-400' },
  tsx: { icon: FileCode, color: 'text-cyan-400' },
  py: { icon: FileCode, color: 'text-green-400' },
  java: { icon: FileCode, color: 'text-red-400' },
  c: { icon: FileCode, color: 'text-blue-300' },
  cpp: { icon: FileCode, color: 'text-blue-300' },
  cs: { icon: FileCode, color: 'text-purple-400' },
  go: { icon: FileCode, color: 'text-cyan-500' },
  rs: { icon: FileCode, color: 'text-orange-400' },
  php: { icon: FileCode, color: 'text-indigo-400' },
  rb: { icon: FileCode, color: 'text-red-500' },
  swift: { icon: FileCode, color: 'text-orange-500' },
  kt: { icon: FileCode, color: 'text-purple-500' },
  sql: { icon: FileCode, color: 'text-blue-500' },
  sh: { icon: FileCode, color: 'text-gray-400' },
  bash: { icon: FileCode, color: 'text-gray-400' },
  html: { icon: FileCode, color: 'text-orange-500' },
  css: { icon: FileCode, color: 'text-blue-500' },
  scss: { icon: FileCode, color: 'text-pink-500' },
  
  // Comprimidos
  zip: { icon: FileArchive, color: 'text-amber-500' },
  rar: { icon: FileArchive, color: 'text-amber-500' },
  '7z': { icon: FileArchive, color: 'text-amber-500' },
  tar: { icon: FileArchive, color: 'text-amber-500' },
  gz: { icon: FileArchive, color: 'text-amber-500' },
  bz2: { icon: FileArchive, color: 'text-amber-500' },
  
  // Audio
  mp3: { icon: FileAudio, color: 'text-purple-500' },
  wav: { icon: FileAudio, color: 'text-purple-500' },
  ogg: { icon: FileAudio, color: 'text-purple-500' },
  flac: { icon: FileAudio, color: 'text-purple-500' },
  aac: { icon: FileAudio, color: 'text-purple-500' },
  m4a: { icon: FileAudio, color: 'text-purple-500' },
  
  // Video
  mp4: { icon: FileVideo, color: 'text-pink-500' },
  avi: { icon: FileVideo, color: 'text-pink-500' },
  mov: { icon: FileVideo, color: 'text-pink-500' },
  mkv: { icon: FileVideo, color: 'text-pink-500' },
  webm: { icon: FileVideo, color: 'text-pink-500' },
  wmv: { icon: FileVideo, color: 'text-pink-500' },
};

const defaultFileType: FileTypeInfo = {
  icon: File,
  color: 'text-gray-500',
};

/**
 * Obtiene el icono y color apropiado para un archivo basado en su extensión o mimeType
 */
export function getFileTypeInfo(filename: string, mimeType?: string): FileTypeInfo {
  // Extraer extensión del nombre de archivo
  const lastDot = filename.lastIndexOf('.');
  if (lastDot > 0) {
    const extension = filename.substring(lastDot + 1).toLowerCase();
    if (extensionMap[extension]) {
      return extensionMap[extension];
    }
  }
  
  // Fallback por mimeType
  if (mimeType) {
    if (mimeType.startsWith('image/')) return extensionMap.jpg;
    if (mimeType.startsWith('audio/')) return extensionMap.mp3;
    if (mimeType.startsWith('video/')) return extensionMap.mp4;
    if (mimeType.startsWith('text/')) return extensionMap.txt;
    if (mimeType.includes('pdf')) return extensionMap.pdf;
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return extensionMap.zip;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return extensionMap.xlsx;
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return extensionMap.pptx;
    if (mimeType.includes('word') || mimeType.includes('document')) return extensionMap.docx;
  }
  
  return defaultFileType;
}

/**
 * Tipos de archivo con preview soportada
 */
const previewableExtensions = new Set([
  // Imágenes
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico',
  // Texto
  'txt', 'md', 'log', 'json', 'xml', 'yaml', 'yml',
  // Código (se muestran como texto)
  'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs',
  'php', 'rb', 'swift', 'kt', 'sql', 'sh', 'bash', 'html', 'css', 'scss',
  // PDF (si hay visor implementado)
  'pdf',
]);

const previewableMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/x-icon',
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/xml',
  'application/pdf',
]);

/**
 * Determina si un archivo puede mostrarse en preview
 */
export function isPreviewable(filename: string, mimeType?: string): boolean {
  // Verificar por extensión
  const lastDot = filename.lastIndexOf('.');
  if (lastDot > 0) {
    const extension = filename.substring(lastDot + 1).toLowerCase();
    if (previewableExtensions.has(extension)) {
      return true;
    }
  }
  
  // Verificar por mimeType
  if (mimeType) {
    if (previewableMimeTypes.has(mimeType)) {
      return true;
    }
    // Cualquier tipo text/* es previewable
    if (mimeType.startsWith('text/')) {
      return true;
    }
    // Cualquier imagen
    if (mimeType.startsWith('image/')) {
      return true;
    }
  }
  
  return false;
}
```

### 3.2 Actualizar AttachmentsPanel

**Importar utilidad:**
```tsx
import { getFileTypeInfo, isPreviewable } from '@/lib/fileIcons';
```

**Eliminar función local `getFileIcon`** (ya no necesaria)

**Actualizar render del icono:**
```tsx
{attachments.map((attachment) => {
  const { icon: FileIcon, color: iconColor } = getFileTypeInfo(attachment.originalName, attachment.mimeType);
  const canPreview = isPreviewable(attachment.originalName, attachment.mimeType);
  const isDeleting = deletingId === attachment.id;
  const isRenaming = renamingId === attachment.id;
  
  return (
    <div key={attachment.id} className="...">
      <FileIcon size={16} className={`${iconColor} flex-shrink-0`} />
      
      {/* ... resto del contenido ... */}
      
      {/* Botón de preview condicional */}
      {canPreview && (
        <button
          onClick={() => setViewingAttachment(attachment)}
          className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="Ver"
        >
          <Eye size={14} />
        </button>
      )}
    </div>
  );
})}
```

---

## 4. Iconos Lucide Necesarios

Verificar que estos iconos estén disponibles en lucide-react:

```tsx
import {
  File,           // ✓ ya usado
  FileImage,      // ← Verificar, podría ser Image
  FileText,       // ✓ ya usado  
  FileSpreadsheet,// ← Puede no existir, usar Table2
  FileVideo,      // ← Verificar, podría ser Video
  FileAudio,      // ← Verificar, podría ser Music
  FileCode,       // ← Verificar, podría ser Code
  FileArchive,    // ← Verificar, podría ser Archive
  FileJson,       // ← Puede no existir, usar Braces
} from 'lucide-react';
```

**Alternativas si algunos no existen:**
- `FileImage` → `Image`
- `FileSpreadsheet` → `Table2` o `Sheet`
- `FileVideo` → `Video`
- `FileAudio` → `Music` o `Headphones`
- `FileCode` → `Code` o `Terminal`
- `FileArchive` → `Archive` o `FolderArchive`
- `FileJson` → `Braces` o `Code`
- `Presentation` → `Presentation` o `MonitorPlay`

---

## 5. Resumen de Cambios

| Archivo | Acción |
|---------|--------|
| `src/lib/fileIcons.ts` | **Crear** - Utilidades de mapeo de iconos y preview |
| `src/app/components/AttachmentsPanel.tsx` | **Modificar** - Multi-upload, iconos, preview condicional |
| `package.json` | Verificar versión de lucide-react para iconos |

---

## 6. Criterios de Aceptación (Técnicos)

- [ ] Input file tiene atributo `multiple`
- [ ] Se muestra progreso "X de Y" durante upload múltiple
- [ ] Nombres de archivo usan `break-words` en vez de `truncate`
- [ ] Archivo `fileIcons.ts` creado con mapeo de extensiones
- [ ] Cada extensión tiene icono y color específico
- [ ] Botón Eye solo aparece si `isPreviewable()` retorna true
- [ ] Los iconos de Lucide usados existen (verificar en documentación)

---

## 7. Testing Manual

1. **Multi-upload por selector:**
   - Click en "Agregar"
   - Seleccionar 3+ archivos
   - Verificar que todos se suben y se muestra progreso

2. **Multi-upload por drag & drop:**
   - Arrastrar 3+ archivos al panel
   - Verificar carga secuencial con progreso

3. **Nombres largos:**
   - Subir archivo con nombre de 50+ caracteres
   - Verificar que se muestra completo con saltos de línea

4. **Iconos:**
   - Subir: imagen.jpg, documento.pdf, hoja.xlsx, codigo.ts, archivo.zip
   - Verificar que cada uno tiene icono diferente

5. **Preview condicional:**
   - Verificar que imágenes y PDFs tienen botón Eye
   - Verificar que .docx, .xlsx, .zip NO tienen botón Eye
