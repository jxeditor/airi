#!/usr/bin/env python3
"""Check missing Chinese translations"""
import yaml
import sys
from pathlib import Path

def load_yaml(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f) or {}

def get_all_keys(d, prefix=''):
    """Recursively get all keys from nested dict"""
    keys = []
    for k, v in d.items():
        new_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            keys.extend(get_all_keys(v, new_key))
        else:
            keys.append(new_key)
    return keys

def main():
    base_dir = Path(__file__).parent.parent
    en_dir = base_dir / 'packages/i18n/src/locales/en'
    zh_dir = base_dir / 'packages/i18n/src/locales/zh-Hans'

    for en_file in en_dir.glob('*.yaml'):
        zh_file = zh_dir / en_file.name
        if not zh_file.exists():
            print(f"Missing Chinese file: {en_file.name}")
            continue

        en_data = load_yaml(en_file)
        zh_data = load_yaml(zh_file)

        en_keys = set(get_all_keys(en_data))
        zh_keys = set(get_all_keys(zh_data))

        missing = en_keys - zh_keys
        if missing:
            print(f"\n{en_file.name}: {len(missing)} missing translations")
            for key in sorted(list(missing)[:10]):
                print(f"  - {key}")
            if len(missing) > 10:
                print(f"  ... and {len(missing) - 10} more")

if __name__ == '__main__':
    main()
