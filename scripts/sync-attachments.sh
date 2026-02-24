#!/bin/bash
# Sincronización bidireccional de adjuntos con el servidor remoto
# Se ejecuta automáticamente antes de npm run dev

REMOTE_HOST="root@192.168.100.113"
REMOTE_PATH="/root/pietrosoft-notes/data/attachments/"
LOCAL_PATH="./data/attachments/"

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Sincronizando adjuntos con el servidor...${NC}"

# Crear directorio local si no existe
mkdir -p "$LOCAL_PATH"

# Asegurar que el directorio remoto existe
ssh -o ConnectTimeout=5 "$REMOTE_HOST" "mkdir -p $REMOTE_PATH" 2>/dev/null

# Sincronización bidireccional con rsync
# --update: solo copia archivos más nuevos
# -avz: archive mode, verbose, compress
PULL_OK=0
PUSH_OK=0

rsync -avz --update "$REMOTE_HOST:$REMOTE_PATH" "$LOCAL_PATH" 2>/dev/null && PULL_OK=1
rsync -avz --update "$LOCAL_PATH" "$REMOTE_HOST:$REMOTE_PATH" 2>/dev/null && PUSH_OK=1

if [ $PULL_OK -eq 1 ] && [ $PUSH_OK -eq 1 ]; then
    echo -e "${GREEN}✓ Adjuntos sincronizados${NC}"
elif [ $PULL_OK -eq 1 ]; then
    echo -e "${GREEN}✓ Adjuntos descargados del servidor${NC}"
elif [ $PUSH_OK -eq 1 ]; then
    echo -e "${GREEN}✓ Adjuntos enviados al servidor${NC}"
else
    echo -e "${YELLOW}⚠ No se pudo conectar al servidor (continuando sin sincronizar)${NC}"
fi
