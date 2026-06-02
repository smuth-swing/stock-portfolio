import re

with open('app.js', encoding='utf-8') as f:
    content = f.read()

# Fix filterMomentumStocks
content = content.replace(
    "const momentumCol = cols.includes('모멘텀') ? '모멘텀' : 'Unnamed: 2';",
    "const momentumCol = currentData.columns.includes('모멘텀') ? '모멘텀' : 'Unnamed: 2';"
)

# Fix prepareNewInvestigationRow Unnamed: 0
old_new_row = """    // 1. 마지막 번호 찾기 (Unnamed: 0 컬럼 기준)
    let maxNum = 0;
    currentData.data.forEach(row => {
        const num = parseInt(row['Unnamed: 0']);
        if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    const nextNum = maxNum + 1;

    // 2. 새로운 빈 행 생성
    const newRow = {};
    currentData.columns.forEach(col => {
        newRow[col] = '';
    });
    newRow['Unnamed: 0'] = nextNum; // 번호 설정"""

new_new_row = """    // 1. 마지막 번호 찾기 (컬럼 0 기준)
    const numCol = currentData.columns[0];
    let maxNum = 0;
    currentData.data.forEach(row => {
        const num = parseInt(row[numCol] || row['Unnamed: 0']);
        if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    const nextNum = maxNum + 1;

    // 2. 새로운 빈 행 생성
    const newRow = {};
    currentData.columns.forEach(col => {
        newRow[col] = '';
    });
    newRow[numCol] = nextNum;
    if (numCol !== 'Unnamed: 0') newRow['Unnamed: 0'] = nextNum; // 번호 설정"""

content = content.replace(old_new_row, new_new_row)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('Patch applied')
