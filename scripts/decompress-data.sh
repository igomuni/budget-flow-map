#!/bin/bash

# Decompress layout data for build
# This script runs as a prebuild hook

DATA_DIR="public/data"
COMPRESSED_FILE="$DATA_DIR/layout.json.gz"
OUTPUT_FILE="$DATA_DIR/layout.json"

# Check if compressed file exists
if [ ! -f "$COMPRESSED_FILE" ]; then
  echo "No compressed layout file found at $COMPRESSED_FILE"
  echo "Skipping decompression (using existing layout.json if available)"
  exit 0
fi

# Check if decompression is needed (compressed file newer than output)
if [ -f "$OUTPUT_FILE" ] && [ "$OUTPUT_FILE" -nt "$COMPRESSED_FILE" ]; then
  echo "Layout data is up to date"
  exit 0
fi

# Decompress
echo "Decompressing $COMPRESSED_FILE..."
gunzip -k -f "$COMPRESSED_FILE"
echo "Done: $OUTPUT_FILE"
