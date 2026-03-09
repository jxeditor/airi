#!/usr/bin/env python3
"""Find hardcoded English text in Vue files"""
import re
from pathlib import Path

def find_hardcoded_text(file_path):
    """Find hardcoded English text in template sections"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract template section
    template_match = re.search(r'<template>(.*?)</template>', content, re.DOTALL)
    if not template_match:
        return []

    template = template_match.group(1)

    # Find text that looks like hardcoded English (not using t() or {{ }})
    # Look for text between > and < that contains English words
    pattern = r'>([A-Z][a-zA-Z\s]{3,})<'
    matches = re.findall(pattern, template)

    # Filter out likely variable names and keep actual sentences
    results = []
    for match in matches:
        match = match.strip()
        if len(match) > 3 and ' ' in match or len(match) > 10:
            results.append(match)

    return results

def main():
    base_dir = Path(__file__).parent.parent
    pages_dir = base_dir / 'packages/stage-pages/src/pages/settings'

    print("Scanning for hardcoded English text...\n")

    for vue_file in pages_dir.rglob('*.vue'):
        hardcoded = find_hardcoded_text(vue_file)
        if hardcoded:
            rel_path = vue_file.relative_to(base_dir)
            print(f"\n{rel_path}:")
            for text in set(hardcoded):
                print(f"  - {text}")

if __name__ == '__main__':
    main()
