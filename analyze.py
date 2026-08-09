import os

with open('MIGRATION_be_diff.txt', 'r', encoding='utf-8') as f:
    lines = [l.strip() for l in f.readlines()]

conflicts = [l.split(': ', 1)[1] for l in lines if l.startswith('CONFLICT: ')]

for f in conflicts:
    try:
        with open(os.path.join('backend', f), 'r', encoding='utf-8') as f1:
            c1 = f1.read().strip()
        val = c1.strip('"\'')
        if val in ['Placeholder', 'Placeholder.', '']:
            print(f + ': backend is placeholder')
        else:
            print(f + ': REAL CONFLICT')
    except Exception as e:
        print(f + ': Error ' + str(e))
