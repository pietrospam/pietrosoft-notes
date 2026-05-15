#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
INPUT_DIR="$SCRIPT_DIR/input"

# ── Verificar que haya archivos JSON en input/ ───────────────────────────────
JSON_COUNT=$(find "$INPUT_DIR" -maxdepth 1 -name "*.json" 2>/dev/null | wc -l)
if [[ "$JSON_COUNT" -eq 0 ]]; then
  echo "❌ No se encontraron archivos .json en: $INPUT_DIR"
  exit 1
fi

echo "📂 Archivos encontrados en input/:"
find "$INPUT_DIR" -maxdepth 1 -name "*.json" -exec basename {} \; | sed 's/^/   • /'
echo ""

# ── Selección de ambiente ────────────────────────────────────────────────────
echo "¿A qué ambiente querés restaurar?"
echo "  1) PROD  (192.168.100.113)"
echo "  2) TEST  (192.168.100.114)"
echo ""
read -rp "Opción [1/2]: " OPTION

case "$OPTION" in
  1)
    TARGET="prod"
    LABEL="PROD (192.168.100.113)"
    ;;
  2)
    TARGET="test"
    LABEL="TEST (192.168.100.114)"
    ;;
  *)
    echo "❌ Opción inválida: '$OPTION'"
    exit 1
    ;;
esac

echo ""
echo "🎯 Destino: $LABEL"
echo "───────────────────────────────────────────"

# ── Confirmación ────────────────────────────────────────────────────────────
read -rp "¿Confirmar restauración? [s/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
  echo "Cancelado."
  exit 0
fi

echo ""

# ── Ejecutar restore ─────────────────────────────────────────────────────────
cd "$PROJECT_DIR"

npx tsx "$SCRIPT_DIR/restore-comments.ts" --target "$TARGET" "$INPUT_DIR"
