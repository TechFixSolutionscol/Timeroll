#!/bin/bash

# Define file paths
INDEX_FILE="index.html"
STYLES_FILE="templates/styles.html"
SCRIPTS_FILE="templates/scripts.html"
OUTPUT_FILE="test.html"

# Check if source files exist
if [ ! -f "$INDEX_FILE" ] || [ ! -f "$STYLES_FILE" ] || [ ! -f "$SCRIPTS_FILE" ]; then
    echo "Error: Source files not found."
    exit 1
fi

# Read contents of partials
styles_content=$(<"$STYLES_FILE")
scripts_content=$(<"$SCRIPTS_FILE")

# Define the patterns to search for. These must be exact matches to the lines in index.html
styles_pattern="<?!= include('templates/styles'); ?>"
scripts_pattern="<?!= include('templates/scripts'); ?>"

# Use awk to replace the include patterns with the actual file content.
# We pass the patterns and content as variables to avoid shell quoting issues.
awk \
  -v styles="$styles_content" \
  -v scripts="$scripts_content" \
  -v sp="$styles_pattern" \
  -v sc="$scripts_pattern" \
  '{
    # Trim leading/trailing whitespace from the line for comparison
    trimmed_line = $0;
    gsub(/^[ \t]+|[ \t]+$/, "", trimmed_line);

    if (trimmed_line == sp) {
      print styles
    } else if (trimmed_line == sc) {
      print scripts
    } else {
      print $0
    }
  }' "$INDEX_FILE" > "$OUTPUT_FILE"

echo "Test file '$OUTPUT_FILE' created successfully."
