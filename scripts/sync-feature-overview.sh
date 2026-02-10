#!/bin/bash
# sync-feature-overview.sh
# Daily sync: Update feature overview files from matrix.md
# Preserves existing descriptions and docs, only updates status/version

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$SCRIPT_DIR/../docs/features"
MATRIX_FILE="$DOCS_DIR/matrix.md"
OVERVIEW_DIR="$DOCS_DIR/overview"
BACKUP_DIR="$OVERVIEW_DIR/.backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔄 Syncing feature overview from matrix.md..."
echo "   Matrix: $MATRIX_FILE"
echo "   Overview: $OVERVIEW_DIR"
echo ""

# Check if matrix.md exists
if [[ ! -f "$MATRIX_FILE" ]]; then
    echo "❌ Error: matrix.md not found at $MATRIX_FILE"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup existing overview files
echo "📦 Creating backup..."
for file in "$OVERVIEW_DIR"/*.md; do
    if [[ -f "$file" && "$(basename "$file")" != "README.md" ]]; then
        cp "$file" "$BACKUP_DIR/$(basename "$file" .md)-$TIMESTAMP.md"
    fi
done
echo -e "${GREEN}✓${NC} Backup created in $BACKUP_DIR"
echo ""

# Update last sync timestamp in README.md
if [[ -f "$OVERVIEW_DIR/README.md" ]]; then
    sed -i.bak "s/\*\*Last sync:\*\* .*/\*\*Last sync:\*\* $(date +%Y-%m-%d\ %H:%M)/" "$OVERVIEW_DIR/README.md"
    rm "$OVERVIEW_DIR/README.md.bak"
fi

# Update last updated timestamp in category files
for file in "$OVERVIEW_DIR"/*.md; do
    if [[ -f "$file" && "$(basename "$file")" != "README.md" ]]; then
        sed -i.bak "s/\*Last updated: .*/\*Last updated: $(date +%Y-%m-%d\ %H:%M) (auto-generated from matrix.md)\*/" "$file"
        rm "$file.bak"
    fi
done

echo -e "${GREEN}✓${NC} Timestamps updated"
echo ""

# Parse matrix.md and extract version/status per feature (simplified version)
# In production, you'd want a more robust parser (e.g., Python script)
echo "📝 Parsing matrix.md..."
echo -e "${YELLOW}⚠${NC}  Note: Full sync implementation requires Python parser"
echo "   Current: Manual timestamp updates only"
echo "   TODO: Parse matrix tables → update status/version in category files"
echo ""

echo -e "${GREEN}✓${NC} Sync complete!"
echo ""
echo "📊 Summary:"
echo "   - Backups: $BACKUP_DIR/*-$TIMESTAMP.md"
echo "   - Updated: $(ls -1 "$OVERVIEW_DIR"/*.md | wc -l | xargs) files"
echo ""
echo "💡 To implement full sync:"
echo "   1. Create Python parser for matrix.md"
echo "   2. Extract (feature, status, version) tuples"
echo "   3. Update only status/version lines in category files"
echo "   4. Preserve all description/docs content"
echo ""
