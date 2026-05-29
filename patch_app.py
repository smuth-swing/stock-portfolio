import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "// 테이블 렌더링"
end_marker = "tbody.appendChild(tr);\n                });"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    end_idx += len(end_marker)
    new_loop = '''// 폼 그리드 리스트로 렌더링
                const listContainer = document.getElementById('ls-trades-list');
                if (listContainer) listContainer.innerHTML = '';
                lsImportData.forEach((trade, idx) => {
                    const div = document.createElement('div');
                    div.className = 'journal-form-container';
                    div.style.padding = '15px';
                    div.style.marginBottom = '10px';
                    div.style.position = 'relative';
                    
                    const isSell = trade.type === '매도';
                    const typeColor = isSell ? '#EF4444' : '#00F2FE';
                    
                    div.innerHTML = `
                        <div style="position:absolute; right:15px; top:15px; z-index:10;">
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; color:var(--text-secondary);">
                                <input type="checkbox" class="ls-trade-cb" data-idx="${idx}" checked style="width:16px; height:16px; accent-color:var(--gold-primary);">
                                선택 포함
                            </label>
                        </div>
                        <div class="form-grid">
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="font-size:12px; margin-bottom:6px;">날짜</label>
                                <input type="text" value="${trade.date}" readonly style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); color:#94A3B8; font-size:14px; pointer-events:none;">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="font-size:12px; margin-bottom:6px;">종목</label>
                                <input type="text" class="ls-trade-name" data-idx="${idx}" value="${trade.name}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:14px;">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="font-size:12px; margin-bottom:6px;">수량</label>
                                <input type="text" value="${trade.qty.toLocaleString()}" readonly style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); color:#E2E8F0; font-size:14px; pointer-events:none;">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="font-size:12px; margin-bottom:6px;">단가</label>
                                <input type="text" value="${trade.price.toLocaleString()}" readonly style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); color:#E2E8F0; font-size:14px; pointer-events:none;">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="font-size:12px; margin-bottom:6px;">매매종류</label>
                                <input type="text" value="${trade.type}" readonly style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); color:${typeColor}; font-weight:bold; font-size:14px; pointer-events:none;">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="font-size:12px; margin-bottom:6px;">투자금(만원)</label>
                                <input type="text" value="${trade.investment.toLocaleString()}" readonly style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); color:var(--gold-light); font-weight:bold; font-size:14px; pointer-events:none;">
                            </div>
                            <div class="form-group" style="margin-bottom:0; grid-column: 1 / -1;">
                                <label style="font-size:12px; margin-bottom:6px;">메모</label>
                                <input type="text" class="ls-trade-memo" data-idx="${idx}" placeholder="메모 입력" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:14px;">
                            </div>
                        </div>
                    `;
                    if (listContainer) listContainer.appendChild(div);
                });'''
    content = content[:start_idx] + new_loop + content[end_idx:]
    open('app.js', 'w', encoding='utf-8').write(content)
    print('Patched successfully')
else:
    print('Markers not found')
