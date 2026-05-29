"""app.js에 LS증권 OpenAPI 연동 스크립트 추가"""

js_code = """
// ============================================================================
// LS증권 거래내역 가져오기 기능
// ============================================================================

let lsImportData = []; // 조회된 거래내역 저장용

function toggleLsImportPanel() {
    const body = document.getElementById('ls-import-body');
    const chevron = document.getElementById('ls-import-chevron');
    if (body.style.display === 'none') {
        body.style.display = 'block';
        chevron.textContent = '▲ 접기';
        
        // 처음 열었을 때 계좌 정보 로드 및 기본 날짜 설정
        if (document.getElementById('ls-account-select').options.length <= 1) {
            initLsImportPanel();
        }
    } else {
        body.style.display = 'none';
        chevron.textContent = '▼ 펼치기';
    }
}

async function initLsImportPanel() {
    // 날짜 기본값 세팅 (최근 1주일)
    setLsDateRange(7);
    
    // 설정 불러와서 계좌 셀렉트 구성
    try {
        const res = await fetch(`${API}/ls/config`);
        if (res.ok) {
            const cfg = await res.json();
            const select = document.getElementById('ls-account-select');
            select.innerHTML = '';
            
            if (cfg.configured && cfg.account) {
                const opt = document.createElement('option');
                opt.value = cfg.account;
                opt.textContent = `${cfg.account}`;
                select.appendChild(opt);
            } else {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = '설정 필요 (서버 파일 확인)';
                select.appendChild(opt);
            }
        }
    } catch (e) {
        console.error('LS config error:', e);
    }
}

function setLsDateRange(days) {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - days);
    
    document.getElementById('ls-to-date').value = toDate.toISOString().split('T')[0];
    document.getElementById('ls-from-date').value = fromDate.toISOString().split('T')[0];
}

async function fetchLsTrades() {
    const fromInput = document.getElementById('ls-from-date').value;
    const toInput = document.getElementById('ls-to-date').value;
    const btn = document.getElementById('ls-fetch-btn');
    const msg = document.getElementById('ls-status-msg');
    const resultDiv = document.getElementById('ls-trades-result');
    const tbody = document.getElementById('ls-trades-tbody');
    
    if (!fromInput || !toInput) {
        alert('시작일과 종료일을 선택하세요.');
        return;
    }
    
    const fromDate = fromInput.replace(/-/g, '');
    const toDate = toInput.replace(/-/g, '');
    
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></div> 조회 중';
    msg.style.display = 'none';
    resultDiv.style.display = 'none';
    
    try {
        const res = await fetch(`${API}/ls/fetch-trades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from_date: fromDate, to_date: toDate, stock_code: '' })
        });
        
        const result = await res.json();
        
        if (res.ok && result.success) {
            lsImportData = result.trades;
            
            if (lsImportData.length === 0) {
                msg.textContent = '해당 기간에 거래 내역이 없습니다.';
                msg.style.backgroundColor = 'rgba(255,255,255,0.05)';
                msg.style.color = 'var(--text-primary)';
                msg.style.display = 'block';
            } else {
                document.getElementById('ls-result-count').textContent = `조회 결과: ${lsImportData.length}건`;
                
                // 테이블 렌더링
                tbody.innerHTML = '';
                lsImportData.forEach((trade, idx) => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
                    
                    const isSell = trade.type === '매도';
                    const typeColor = isSell ? '#EF4444' : '#00F2FE';
                    const typeBg = isSell ? 'rgba(239,68,68,0.1)' : 'rgba(0,242,254,0.1)';
                    
                    tr.innerHTML = `
                        <td style="padding:10px 8px; text-align:center;">
                            <input type="checkbox" class="ls-trade-cb" data-idx="${idx}" checked style="width:14px; height:14px; accent-color:var(--gold-primary);">
                        </td>
                        <td style="padding:10px 8px;">${trade.date}</td>
                        <td style="padding:10px 8px; font-weight:bold;">
                            <input type="text" class="ls-trade-name" data-idx="${idx}" value="${trade.name}" style="background:transparent; border:1px solid rgba(255,255,255,0.1); color:white; width:100%; border-radius:4px; padding:4px;">
                        </td>
                        <td style="padding:10px 8px; text-align:center;">
                            <span style="background:${typeBg}; color:${typeColor}; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px;">
                                ${trade.type}
                            </span>
                        </td>
                        <td style="padding:10px 8px; text-align:right;">${trade.qty.toLocaleString()}</td>
                        <td style="padding:10px 8px; text-align:right;">${trade.price.toLocaleString()}</td>
                        <td style="padding:10px 8px; text-align:right;">${trade.investment.toLocaleString()}</td>
                        <td style="padding:10px 8px;">
                            <input type="text" class="ls-trade-memo" data-idx="${idx}" placeholder="메모" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:white; width:100%; border-radius:4px; padding:4px;">
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
                
                resultDiv.style.display = 'block';
            }
        } else {
            msg.textContent = `조회 실패: ${result.error || '알 수 없는 오류'}`;
            msg.style.backgroundColor = 'rgba(239,68,68,0.1)';
            msg.style.color = '#EF4444';
            msg.style.display = 'block';
        }
    } catch (e) {
        msg.textContent = `서버 연결 오류: ${e.message}`;
        msg.style.backgroundColor = 'rgba(239,68,68,0.1)';
        msg.style.color = '#EF4444';
        msg.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 조회';
    }
}

function lsToggleAll(checked) {
    const cbs = document.querySelectorAll('.ls-trade-cb');
    cbs.forEach(cb => {
        cb.checked = checked;
    });
}

async function importLsTrades() {
    // 체크된 항목 가져오기
    const selectedIndices = Array.from(document.querySelectorAll('.ls-trade-cb'))
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.dataset.idx, 10));
        
    if (selectedIndices.length === 0) {
        alert('저장할 항목을 선택하세요.');
        return;
    }
    
    // 최신 입력값(종목명, 메모) 반영
    const tradesToSave = selectedIndices.map(idx => {
        const trade = { ...lsImportData[idx] };
        
        // 종목명 수정 반영
        const nameInput = document.querySelector(`.ls-trade-name[data-idx="${idx}"]`);
        if (nameInput) trade.name = nameInput.value.trim() || trade.name;
        
        // 메모 추가
        const memoInput = document.querySelector(`.ls-trade-memo[data-idx="${idx}"]`);
        if (memoInput) trade.memo = memoInput.value.trim();
        
        return trade;
    });
    
    const btn = document.querySelector('#ls-trades-result .btn-primary');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></div> 저장 중';
    
    try {
        const res = await fetch(`${API}/ls/import-trades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: TARGET_FILE, trades: tradesToSave })
        });
        
        const result = await res.json();
        if (result.success) {
            showToast(`✅ ${result.saved}건의 거래가 매매일지에 저장되었습니다.`, 'success');
            
            // 패널 접기 & 결과 지우기
            document.getElementById('ls-import-body').style.display = 'none';
            document.getElementById('ls-import-chevron').textContent = '▼ 펼치기';
            document.getElementById('ls-trades-result').style.display = 'none';
            lsImportData = [];
            
            // 테이블 데이터 새로고침
            refreshData(true);
        } else {
            alert(`저장 실패: ${result.error}`);
        }
    } catch (e) {
        alert(`저장 오류: ${e.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}
"""

with open('app.js', 'a', encoding='utf-8') as f:
    f.write(js_code)
    
print("app.js에 기능 추가 완료!")
