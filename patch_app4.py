import re

with open('app.js', encoding='utf-8') as f:
    content = f.read()

# Fix in renderInvestigationCards
content = content.replace(
    "const momentumCol = 'Unnamed: 2'; // 모멘텀(시점)",
    "const momentumCol = cols.includes('모멘텀') ? '모멘텀' : 'Unnamed: 2';"
)

# Fix in prepareNewInvestigationRow
content = content.replace(
    "newRow['Unnamed: 2'] = ''; // 모멘텀",
    "newRow['모멘텀'] = ''; newRow['Unnamed: 2'] = ''; // 모멘텀"
)

# Also fix the mapColumnLabel to support actual names
content = content.replace(
    "if (columnName === 'Unnamed: 2') return '모멘텀(시점)';",
    "if (columnName === 'Unnamed: 2') return '모멘텀(시점)';\n    if (columnName === '모멘텀') return '모멘텀(시점)';"
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('Patch applied')
