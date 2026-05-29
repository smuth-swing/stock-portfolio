import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the rendering loop
start_marker = "// 폼 그리드 리스트로 렌더링"
end_marker = "if (listContainer) listContainer.appendChild(div);\n                });"

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
                    
                    // 투자금 백만원 단위 반올림 및 기존 포트폴리오 금액 반영 계산
                    const baseAmount = portfolioMapCache[trade.name] || 0;
                    const tradeOnes = Math.round((trade.qty * trade.price) / 1000000);
                    const tradeAmount = tradeOnes * 100;
                    
                    let computedInvestment = tradeAmount;
                    if (baseAmount > 0) {
                        if (isSell) {
                            computedInvestment = Math.max(0, baseAmount - tradeAmount);
                        } else {
                            computedInvestment = baseAmount + tradeAmount;
                        }
                    } else if (isSell) {
                        computedInvestment = 0;
                    }
                    // 서버로 보낼 때 사용할 투자금으로 갱신
                    trade.investment = computedInvestment;
                    
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
                                <input type="text" class="ls-trade-date" data-idx="${idx}" value="${trade.date}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); color:#fff; font-size:14px;">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="font-size:12px; margin-bottom:6px;">종목</label>
                                <input type="text" class="ls-trade-name" data-idx="${idx}" value="${trade.name}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:14px;">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="font-size:12px; margin-bottom:6px;">수량</label>
                                <input type="number" class="ls-trade-qty" data-idx="${idx}" value="${trade.qty}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:14px;">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="font-size:12px; margin-bottom:6px;">단가</label>
                                <input type="number" class="ls-trade-price" data-idx="${idx}" value="${trade.price}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:14px;">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="font-size:12px; margin-bottom:6px;">매매종류</label>
                                <input type="text" class="ls-trade-type" data-idx="${idx}" value="${trade.type}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:${typeColor}; font-weight:bold; font-size:14px;">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="font-size:12px; margin-bottom:6px;">투자금(만원)</label>
                                <input type="number" class="ls-trade-inv" data-idx="${idx}" value="${trade.investment}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--gold-light); font-weight:bold; font-size:14px;">
                            </div>
                        </div>
                    `;
                    if (listContainer) listContainer.appendChild(div);
                });'''
    content = content[:start_idx] + new_loop + content[end_idx:]
    
    # Now patch importLsTrades
    import_start = content.find("const tradesToSave = selectedIndices.map(idx => {")
    import_end = content.find("return trade;\n    });")
    if import_start != -1 and import_end != -1:
        import_end += len("return trade;\n    });")
        new_import = '''const tradesToSave = selectedIndices.map(idx => {
        const trade = { ...lsImportData[idx] };
        
        // 사용자가 수정한 값 반영
        const dateInput = document.querySelector(`.ls-trade-date[data-idx="${idx}"]`);
        if (dateInput) trade.date = dateInput.value.trim() || trade.date;
        
        const nameInput = document.querySelector(`.ls-trade-name[data-idx="${idx}"]`);
        if (nameInput) trade.name = nameInput.value.trim() || trade.name;
        
        const qtyInput = document.querySelector(`.ls-trade-qty[data-idx="${idx}"]`);
        if (qtyInput) trade.qty = parseFloat(qtyInput.value) || trade.qty;
        
        const priceInput = document.querySelector(`.ls-trade-price[data-idx="${idx}"]`);
        if (priceInput) trade.price = parseFloat(priceInput.value) || trade.price;
        
        const typeInput = document.querySelector(`.ls-trade-type[data-idx="${idx}"]`);
        if (typeInput) trade.type = typeInput.value.trim() || trade.type;
        
        const invInput = document.querySelector(`.ls-trade-inv[data-idx="${idx}"]`);
        if (invInput) trade.investment = parseFloat(invInput.value) || trade.investment;
        
        trade.memo = ''; // 메모 필드는 삭제됨
        
        return trade;
    });'''
        content = content[:import_start] + new_import + content[import_end:]
        
    open('app.js', 'w', encoding='utf-8').write(content)
    print('app.js UI rendering updated')
else:
    print('Failed to find rendering loop in app.js')
