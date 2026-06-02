import os

path = r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\StockPortfolioApp\src\screens\InvestigationScreen.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Chunk 1: filter state
content = content.replace(
    "const [filter, setFilter] = useState<'all' | 'strategy'>('all');",
    """const [filter, setFilter] = useState<'all' | 'strategy' | 'priority'>('all');
  
  // 엑셀 컬럼명 변경 대응을 위한 헬퍼 함수
  const getStockName = (item: any) => item['종목명'] || item['Unnamed: 1'] || '';
  const getMomentum = (item: any) => item['모멘텀'] || item['Unnamed: 2'] || item['Unnamed: 1'] /* prev error fallback */ || '';
  const getReason = (item: any) => item['매수이유'] || item['Unnamed: 3'] || '';
  const getRisk = (item: any) => item['리스크'] || item['Unnamed: 4'] || '';
  const getCeo = (item: any) => item['대표/경영진'] || item['Unnamed: 5'] || '';
  const getStrategy = (item: any) => item['매매 전략'] || item['Unnamed: 6'] || '';"""
)

# Chunk 2: filtering logic
old_filter = """  const allData = investigation?.data || [];
  const allItems = allData.slice(2).map((r: any, idx: number) => ({ ...r, _realIndex: idx + 2 })).filter((r: any) => r['Unnamed: 1']);
  
  const items = allItems.filter((item: any) => {
    if (filter === 'strategy' && !item['Unnamed: 6']) return false;
    if (searchQuery.trim() !== '') {
      const stockName = item['Unnamed: 1'] || '';
      if (!stockName.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    }
    return true;
  });"""

new_filter = """  const allData = investigation?.data || [];
  const allItems = allData.filter((r: any) => getStockName(r));
  
  const items = allItems.filter((item: any) => {
    if (filter === 'strategy' && !getStrategy(item)) return false;
    if (filter === 'priority' && !getMomentum(item)) return false;
    if (searchQuery.trim() !== '') {
      const stockName = getStockName(item);
      if (!stockName.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    }
    return true;
  });"""
content = content.replace(old_filter, new_filter)

# Chunk 3: startEditing
old_start_edit = """  const startEditing = (realIdx: number, item: any) => {
    setEditingIndex(realIdx);
    setEditForm({
      reason: item['Unnamed: 3'] || '',    // 매수 이유 (col4)
      risk: item['Unnamed: 4'] || '',      // 리스크 (col5)
      momentum: item['Unnamed: 1'] || '',  // 핵심 모멘텀 (col2) ← Unnamed:1
      strategy: item['Unnamed: 6'] || '',  // 매매 전략 (col7)
      ceo: item['Unnamed: 5'] || ''        // 대표/경영진 (col6)
    });
  };"""
new_start_edit = """  const startEditing = (realIdx: number, item: any) => {
    setEditingIndex(realIdx);
    setEditForm({
      reason: getReason(item),
      risk: getRisk(item),
      momentum: getMomentum(item),
      strategy: getStrategy(item),
      ceo: getCeo(item)
    });
  };"""
content = content.replace(old_start_edit, new_start_edit)

# Chunk 4: saveEditing mapped fields
old_save_data = """      // 실제 엑셀 컬럼 구조에 맞는 올바른 매핑
      // col1=번호(Unnamed:0), col2=종목명(Unnamed:1), col3=빈열(Unnamed:2)
      // col4=매수이유(Unnamed:3), col5=리스크(Unnamed:4), col6=대표(Unnamed:5), col7=매매전략(Unnamed:6)
      const newRowData = { 
        ...rowData, 
        'Unnamed: 3': editForm.reason,    // 매수 이유 → col4
        'Unnamed: 4': editForm.risk,      // 리스크 → col5
        'Unnamed: 1': editForm.momentum,  // 핵심 모멘텀 → col2 (종목명 다음 칸)
        'Unnamed: 6': editForm.strategy,  // 매매 전략 → col7
        'Unnamed: 5': editForm.ceo        // 대표/경영진 → col6
      };"""
new_save_data = """      // 하위호환성(Unnamed) 및 신규 컬럼명 모두 지원
      const newRowData = { 
        ...rowData, 
        '매수이유': editForm.reason, 'Unnamed: 3': editForm.reason,
        '리스크': editForm.risk, 'Unnamed: 4': editForm.risk,
        '모멘텀': editForm.momentum, 'Unnamed: 2': editForm.momentum, 'Unnamed: 1': editForm.momentum,
        '매매 전략': editForm.strategy, 'Unnamed: 6': editForm.strategy,
        '대표/경영진': editForm.ceo, 'Unnamed: 5': editForm.ceo
      };"""
content = content.replace(old_save_data, new_save_data)

# Chunk 5: Filter buttons
old_filter_btns = """            <TouchableOpacity 
              style={[styles.filterBtn, filter === 'strategy' && styles.filterBtnActive]}
              onPress={() => setFilter('strategy')}
            >
              <Text style={[styles.filterBtnText, filter === 'strategy' && styles.filterBtnTextActive]}>전략보유</Text>
            </TouchableOpacity>
          </View>"""
new_filter_btns = """            <TouchableOpacity 
              style={[styles.filterBtn, filter === 'strategy' && styles.filterBtnActive]}
              onPress={() => setFilter('strategy')}
            >
              <Text style={[styles.filterBtnText, filter === 'strategy' && styles.filterBtnTextActive]}>전략보유</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterBtn, filter === 'priority' && styles.filterBtnActive]}
              onPress={() => setFilter('priority')}
            >
              <Text style={[styles.filterBtnText, filter === 'priority' && styles.filterBtnTextActive]}>매매우선</Text>
            </TouchableOpacity>
          </View>"""
content = content.replace(old_filter_btns, new_filter_btns)

# Chunk 6: Render Title Row
old_title_row = """                  <View style={styles.titleRow}>
                    <Text style={styles.stockName}>
                      {item['Unnamed: 1']}
                    </Text>
                    {item['Unnamed: 6'] ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>전략 보유</Text>
                      </View>
                    ) : null}"""
new_title_row = """                  <View style={styles.titleRow}>
                    <Text style={[styles.stockName, getMomentum(item) ? { color: '#EF4444' } : null]}>
                      {getStockName(item)}
                    </Text>
                    {getStrategy(item) ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>전략 보유</Text>
                      </View>
                    ) : null}"""
content = content.replace(old_title_row, new_title_row)

# Chunk 7: Render Sections
old_section_reason = "{item['Unnamed: 3'] ? (\n                          <View style={styles.section}>\n                            <Text style={styles.sectionTitle}>🎯 매수 이유</Text>\n                            <Text style={styles.sectionText}>{item['Unnamed: 3']}</Text>"
new_section_reason = "{getReason(item) ? (\n                          <View style={styles.section}>\n                            <Text style={styles.sectionTitle}>🎯 매수 이유</Text>\n                            <Text style={styles.sectionText}>{getReason(item)}</Text>"
content = content.replace(old_section_reason, new_section_reason)

old_section_risk = "{item['Unnamed: 4'] ? (\n                          <View style={styles.section}>\n                            <Text style={styles.sectionTitle}>⚠️ 리스크</Text>\n                            <Text style={styles.sectionText}>{item['Unnamed: 4']}</Text>"
new_section_risk = "{getRisk(item) ? (\n                          <View style={styles.section}>\n                            <Text style={styles.sectionTitle}>⚠️ 리스크</Text>\n                            <Text style={styles.sectionText}>{getRisk(item)}</Text>"
content = content.replace(old_section_risk, new_section_risk)

old_section_momentum = "{item['Unnamed: 2'] ? (\n                          <View style={styles.section}>\n                            <Text style={styles.sectionTitle}>💡 핵심 모멘텀</Text>\n                            <Text style={styles.sectionText}>{item['Unnamed: 2']}</Text>"
new_section_momentum = "{getMomentum(item) ? (\n                          <View style={styles.section}>\n                            <Text style={styles.sectionTitle}>💡 핵심 모멘텀</Text>\n                            <Text style={styles.sectionText}>{getMomentum(item)}</Text>"
content = content.replace(old_section_momentum, new_section_momentum)

old_section_strategy = "{item['Unnamed: 6'] ? (\n                          <View style={styles.section}>\n                            <Text style={styles.sectionTitle}>📈 매매 전략</Text>\n                            <Text style={styles.sectionText}>{item['Unnamed: 6']}</Text>"
new_section_strategy = "{getStrategy(item) ? (\n                          <View style={styles.section}>\n                            <Text style={styles.sectionTitle}>📈 매매 전략</Text>\n                            <Text style={styles.sectionText}>{getStrategy(item)}</Text>"
content = content.replace(old_section_strategy, new_section_strategy)

old_section_ceo = "{item['Unnamed: 5'] ? (\n                          <View style={styles.section}>\n                            <Text style={styles.sectionTitle}>👤 대표 / 경영진</Text>\n                            <Text style={styles.sectionText}>{item['Unnamed: 5']}</Text>"
new_section_ceo = "{getCeo(item) ? (\n                          <View style={styles.section}>\n                            <Text style={styles.sectionTitle}>👤 대표 / 경영진</Text>\n                            <Text style={styles.sectionText}>{getCeo(item)}</Text>"
content = content.replace(old_section_ceo, new_section_ceo)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done patching')
