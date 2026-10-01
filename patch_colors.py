import re

def fix_colors(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Add errorBg and errorBorder
    content = content.replace(
        "error: '#EF4444',",
        "error: '#EF4444',\n  errorBg: 'rgba(239, 68, 68, 0.12)',\n  errorBorder: 'rgba(239, 68, 68, 0.3)',"
    )

    with open(filepath, 'w') as f:
        f.write(content)

fix_colors('src/theme/colors.ts')
