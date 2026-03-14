/**
 * File type icons and preview support utilities
 * SPEC-010: Mejoras UX de Anexos
 */

import {
  File,
  Image,
  FileText,
  Table2,
  Video,
  Music,
  Code,
  Archive,
  Braces,
  Presentation,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FileTypeInfo {
  icon: LucideIcon;
  color: string;  // Tailwind color class
}

const extensionMap: Record<string, FileTypeInfo> = {
  // Imágenes
  jpg: { icon: Image, color: 'text-green-500' },
  jpeg: { icon: Image, color: 'text-green-500' },
  png: { icon: Image, color: 'text-green-500' },
  gif: { icon: Image, color: 'text-green-500' },
  webp: { icon: Image, color: 'text-green-500' },
  svg: { icon: Image, color: 'text-green-500' },
  ico: { icon: Image, color: 'text-green-500' },
  bmp: { icon: Image, color: 'text-green-500' },
  
  // Documentos PDF
  pdf: { icon: FileText, color: 'text-red-500' },
  
  // Documentos Office - Word
  doc: { icon: FileText, color: 'text-blue-500' },
  docx: { icon: FileText, color: 'text-blue-500' },
  odt: { icon: FileText, color: 'text-blue-500' },
  rtf: { icon: FileText, color: 'text-blue-500' },
  
  // Documentos Office - Excel
  xls: { icon: Table2, color: 'text-emerald-500' },
  xlsx: { icon: Table2, color: 'text-emerald-500' },
  ods: { icon: Table2, color: 'text-emerald-500' },
  csv: { icon: Table2, color: 'text-emerald-500' },
  
  // Documentos Office - PowerPoint
  ppt: { icon: Presentation, color: 'text-orange-500' },
  pptx: { icon: Presentation, color: 'text-orange-500' },
  odp: { icon: Presentation, color: 'text-orange-500' },
  
  // Archivos de texto
  txt: { icon: FileText, color: 'text-gray-400' },
  md: { icon: FileText, color: 'text-gray-400' },
  log: { icon: FileText, color: 'text-gray-400' },
  
  // JSON/Config
  json: { icon: Braces, color: 'text-yellow-500' },
  xml: { icon: Code, color: 'text-yellow-500' },
  yaml: { icon: Code, color: 'text-yellow-500' },
  yml: { icon: Code, color: 'text-yellow-500' },
  toml: { icon: Code, color: 'text-yellow-500' },
  
  // Código fuente
  js: { icon: Code, color: 'text-yellow-400' },
  ts: { icon: Code, color: 'text-blue-400' },
  jsx: { icon: Code, color: 'text-cyan-400' },
  tsx: { icon: Code, color: 'text-cyan-400' },
  py: { icon: Code, color: 'text-green-400' },
  java: { icon: Code, color: 'text-red-400' },
  c: { icon: Code, color: 'text-blue-300' },
  cpp: { icon: Code, color: 'text-blue-300' },
  cs: { icon: Code, color: 'text-purple-400' },
  go: { icon: Code, color: 'text-cyan-500' },
  rs: { icon: Code, color: 'text-orange-400' },
  php: { icon: Code, color: 'text-indigo-400' },
  rb: { icon: Code, color: 'text-red-500' },
  swift: { icon: Code, color: 'text-orange-500' },
  kt: { icon: Code, color: 'text-purple-500' },
  sql: { icon: Code, color: 'text-blue-500' },
  sh: { icon: Code, color: 'text-gray-400' },
  bash: { icon: Code, color: 'text-gray-400' },
  html: { icon: Code, color: 'text-orange-500' },
  css: { icon: Code, color: 'text-blue-500' },
  scss: { icon: Code, color: 'text-pink-500' },
  
  // Comprimidos
  zip: { icon: Archive, color: 'text-amber-500' },
  rar: { icon: Archive, color: 'text-amber-500' },
  '7z': { icon: Archive, color: 'text-amber-500' },
  tar: { icon: Archive, color: 'text-amber-500' },
  gz: { icon: Archive, color: 'text-amber-500' },
  bz2: { icon: Archive, color: 'text-amber-500' },
  
  // Audio
  mp3: { icon: Music, color: 'text-purple-500' },
  wav: { icon: Music, color: 'text-purple-500' },
  ogg: { icon: Music, color: 'text-purple-500' },
  flac: { icon: Music, color: 'text-purple-500' },
  aac: { icon: Music, color: 'text-purple-500' },
  m4a: { icon: Music, color: 'text-purple-500' },
  
  // Video
  mp4: { icon: Video, color: 'text-pink-500' },
  avi: { icon: Video, color: 'text-pink-500' },
  mov: { icon: Video, color: 'text-pink-500' },
  mkv: { icon: Video, color: 'text-pink-500' },
  webm: { icon: Video, color: 'text-pink-500' },
  wmv: { icon: Video, color: 'text-pink-500' },
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
