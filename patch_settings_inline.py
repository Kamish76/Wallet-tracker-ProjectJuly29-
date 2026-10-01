def fix_inline(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    content = content.replace("color: '#EF4444'", "color: Colors.expense")
    content = content.replace("color: '#10B981'", "color: Colors.income")
    content = content.replace("color: '#3B82F6'", "color: Colors.syncing")

    with open(filepath, 'w') as f:
        f.write(content)

fix_inline('src/app/(tabs)/settings.tsx')
