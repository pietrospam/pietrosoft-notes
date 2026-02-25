// REQ-008.3: Client Color Palette
// 32 colors optimized for dark theme backgrounds (gray-900/gray-800)

export const CLIENT_COLORS = [
  // Reds / Pinks
  '#EF4444', // red-500
  '#F43F5E', // rose-500
  '#EC4899', // pink-500
  '#DB2777', // pink-600
  
  // Oranges / Ambers
  '#F97316', // orange-500
  '#FB923C', // orange-400
  '#F59E0B', // amber-500
  '#FBBF24', // amber-400
  
  // Yellows / Limes
  '#EAB308', // yellow-500
  '#A3E635', // lime-400
  '#84CC16', // lime-500
  '#65A30D', // lime-600
  
  // Greens
  '#22C55E', // green-500
  '#10B981', // emerald-500
  '#14B8A6', // teal-500
  '#059669', // emerald-600
  
  // Cyans / Blues
  '#06B6D4', // cyan-500
  '#0EA5E9', // sky-500
  '#3B82F6', // blue-500
  '#2563EB', // blue-600
  
  // Indigos / Purples
  '#6366F1', // indigo-500
  '#8B5CF6', // violet-500
  '#A855F7', // purple-500
  '#7C3AED', // violet-600
  
  // Fuchsias / Special
  '#D946EF', // fuchsia-500
  '#C026D3', // fuchsia-600
  '#E879F9', // fuchsia-400
  '#9333EA', // purple-600
  
  // Grays / Neutrals (for variety)
  '#64748B', // slate-500
  '#78716C', // stone-500
  '#71717A', // zinc-500
  '#6B7280', // gray-500
] as const;

export type ClientColor = typeof CLIENT_COLORS[number];

/**
 * Get the next available color that is not already used by existing clients
 * @param usedColors Array of colors already in use
 * @returns The first available color, or a random one if all are used
 */
export function getNextAvailableColor(usedColors: (string | null | undefined)[]): string {
  const usedSet = new Set(usedColors.filter(Boolean));
  
  // Find first unused color
  for (const color of CLIENT_COLORS) {
    if (!usedSet.has(color)) {
      return color;
    }
  }
  
  // All colors used - return a random one
  return CLIENT_COLORS[Math.floor(Math.random() * CLIENT_COLORS.length)];
}

/**
 * Determine if text should be white or black based on background color
 * Uses luminance calculation for optimal contrast
 * @param hexColor Hex color code (e.g., '#EF4444')
 * @returns 'white' or 'black'
 */
export function getContrastTextColor(hexColor: string): 'white' | 'black' {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate relative luminance (ITU-R BT.709)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for bright colors, white for dark colors
  return luminance > 0.5 ? 'black' : 'white';
}

/**
 * Get a slightly transparent version of a color for backgrounds
 * @param hexColor Hex color code
 * @param opacity Opacity value (0-1)
 * @returns RGBA string
 */
export function getColorWithOpacity(hexColor: string, opacity: number): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
