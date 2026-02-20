#!/bin/bash
# Script to load sample data into the workspace

WORKSPACE_PATH="${WORKSPACE_PATH:-./data}"

echo "Loading sample data into $WORKSPACE_PATH..."

# Copy clients
cp -f data/sample/clients.json "$WORKSPACE_PATH/clients.json"
echo "✓ Loaded clients"

# Copy projects
cp -f data/sample/projects.json "$WORKSPACE_PATH/projects.json"
echo "✓ Loaded projects"

# Copy notes
mkdir -p "$WORKSPACE_PATH/notes"
cp -f data/sample/notes/*.json "$WORKSPACE_PATH/notes/"
echo "✓ Loaded notes"

echo ""
echo "Sample data loaded successfully!"
echo "- 3 clients"
echo "- 4 projects"
echo "- 7 notes (1 general, 2 tasks, 2 connections, 2 timesheets)"
