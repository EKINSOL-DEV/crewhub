#!/usr/bin/env python3
"""
sync-feature-overview.py
Daily sync: Update feature overview files from matrix.md

Updates ONLY status/version lines, preserves all descriptions and docs.
"""

import re
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

# Category mapping
CATEGORIES = {
    "core": "Core Platform Features",
    "3d-world": "3D World & Visualization",
    "ui": "User Interface",
    "productivity": "Productivity Tools",
    "creative": "Creative & Customization",
    "meta": "Meta & Internal"
}

def parse_matrix_table(content: str, category_title: str) -> List[Tuple[str, str, str]]:
    """
    Parse a category table from matrix.md
    Returns: List of (feature_name, status, version) tuples
    """
    features = []
    
    # Find the category section
    category_pattern = rf"## {re.escape(category_title)}.*?\n(.*?)\n\*\*Total:"
    match = re.search(category_pattern, content, re.DOTALL)
    
    if not match:
        return features
    
    table_text = match.group(1)
    
    # Parse table rows (skip header and separator)
    lines = table_text.strip().split('\n')[2:]  # Skip | Feature | Status | ... and |---|---|...
    
    for line in lines:
        if line.startswith('|') and '|' in line[1:]:
            parts = [p.strip() for p in line.split('|')[1:-1]]  # Remove empty first/last
            if len(parts) >= 3:
                feature = parts[0].replace('**', '')  # Remove markdown bold
                status = parts[1]
                version = parts[2]
                features.append((feature, status, version))
    
    return features

def update_category_file(filepath: Path, features: List[Tuple[str, str, str]]):
    """
    Update status and version lines in a category file
    Preserves descriptions and docs sections
    """
    if not filepath.exists():
        print(f"   ⚠️  File not found: {filepath}")
        return
    
    content = filepath.read_text()
    updated = content
    changes = 0
    
    for feature_name, status, version in features:
        # Find the feature section
        # Pattern: ## FeatureName\n**Status:** ...
        pattern = rf"(## {re.escape(feature_name)}\s*\n\*\*Status:\*\*) ([^\n]+)"
        
        # Build new status line
        status_emoji = status
        version_text = version.replace('TBD', '(no version assigned)')
        new_status = f"\\1 {status_emoji} {version_text}"
        
        # Replace if found
        new_content = re.sub(pattern, new_status, updated)
        if new_content != updated:
            changes += 1
            updated = new_content
    
    # Update timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    updated = re.sub(
        r"\*Last updated: .*\*",
        f"*Last updated: {timestamp} (auto-generated from matrix.md)*",
        updated
    )
    
    # Write back
    filepath.write_text(updated)
    print(f"   ✓ Updated {filepath.name} ({changes} features)")

def main():
    script_dir = Path(__file__).parent
    docs_dir = script_dir.parent / "docs" / "features"
    matrix_file = docs_dir / "matrix.md"
    overview_dir = docs_dir / "overview"
    backup_dir = overview_dir / ".backups"
    
    print("🔄 Syncing feature overview from matrix.md...")
    print(f"   Matrix: {matrix_file}")
    print(f"   Overview: {overview_dir}\n")
    
    # Check files exist
    if not matrix_file.exists():
        print(f"❌ Error: matrix.md not found at {matrix_file}")
        return 1
    
    # Create backup directory
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    # Backup existing files
    print("📦 Creating backup...")
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    for file in overview_dir.glob("*.md"):
        if file.name != "README.md":
            backup_file = backup_dir / f"{file.stem}-{timestamp}.md"
            backup_file.write_text(file.read_text())
    print(f"   ✓ Backup created in {backup_dir}\n")
    
    # Read matrix.md
    matrix_content = matrix_file.read_text()
    
    # Parse each category
    print("📝 Parsing matrix.md and updating category files...\n")
    
    for category_key, category_title in CATEGORIES.items():
        features = parse_matrix_table(matrix_content, category_title)
        if features:
            category_file = overview_dir / f"{category_key}.md"
            update_category_file(category_file, features)
    
    # Update README timestamp
    readme_file = overview_dir / "README.md"
    if readme_file.exists():
        readme_content = readme_file.read_text()
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        readme_content = re.sub(
            r"\*\*Last sync:\*\* .*",
            f"**Last sync:** {timestamp}",
            readme_content
        )
        readme_file.write_text(readme_content)
        print(f"   ✓ Updated README.md")
    
    print("\n✅ Sync complete!")
    print(f"\n📊 Summary:")
    print(f"   - Backups: {backup_dir}/*-{timestamp}.md")
    print(f"   - Updated: {len(list(overview_dir.glob('*.md')))} files")
    
    return 0

if __name__ == "__main__":
    exit(main())
