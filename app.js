/**
 * Excel Viewer - 주식 체크 리스트 고정 뷰어
 */

const IS_GITHUB_PAGES = window.location.hostname.includes('github.io');
const API = IS_GITHUB_PAGES ? 'StockPortfolioApp/public/data' : 'http://localhost:5000/api';
const TARGET_FILE = '주식 체크 리스트_20220328.xlsx';

const GITHUB_JSON_MAP = {
    '매매일지': 'trade_journal.json',
    '포트폴리오 맵': 'portfolio_map.json',
    '탐구생활': 'investigation.json',
    '실적': 'performance.json',
    '배당금': 'dividend.json'
};
const EXPLORATION_SHEET_KEYWORD = '탐구';
let currentData = null;
let autoRefreshTimer = null;
const REFRESH_INTERVAL = 30000; // 30초
let portfolioMapCache = {}; // { 종목명: 기본투자금(만원) }
let investigationPriorityCache = new Set(); // 탐구생활 시트 기반 매매우선 종목 캐시

// 현금 계좌 데이터: [{ name: '계좌명', amount: 금액(백만 단위) }, ...]
let cashAccounts = [];
try {
    const savedCash = localStorage.getItem('cashAccounts');
    if (savedCash) cashAccounts = JSON.parse(savedCash);
} catch (e) {
    console.warn('현금 계좌 데이터 복원 실패:', e);
    cashAccounts = [];
}

// 투자금 계좌 데이터: [{ name: '계좌명', amount: 금액(백만 단위) }, ...]
let investAccounts = [];
try {
    const savedInvest = localStorage.getItem('investAccounts');
    if (savedInvest) investAccounts = JSON.parse(savedInvest);
} catch (e) {
    console.warn('투자금 계좌 데이터 복원 실패:', e);
    investAccounts = [];
}

// 월별 현금 & 투자금 스냅샷 데이터: [{ month: 'YYYY-MM', investment: 백만, cash: 백만, totalAsset: 백만, ratio: % }, ...]
let monthlyCashSnapshots = [];
try {
    const savedSnapshots = localStorage.getItem('monthlyCashSnapshots');
    if (savedSnapshots) monthlyCashSnapshots = JSON.parse(savedSnapshots);
} catch (e) {
    console.warn('월별 현금 스냅샷 복원 실패:', e);
    monthlyCashSnapshots = [];
}

// 페이지 로드 후 기존 스냅샷을 서버에 자동 동기화 (모바일과 데이터 공유)
setTimeout(() => {
    if (monthlyCashSnapshots.length > 0) {
        const pcIp = localStorage.getItem('pc_ip') || '192.168.0.2';
        fetch(`http://${pcIp}:5000/api/cash-snapshots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(monthlyCashSnapshots)
        }).then(r => r.ok && console.log('📤 기존 현금 스냅샷 서버 동기화 완료'))
          .catch(() => {});
    }
}, 2000);
let cashTrendChart = null; // 월별 현금 비중 트렌드 Chart.js 인스턴스
let investigationRowMap = [];
let selectedInvestigationRowIndex = null;
let investigationCurrentRows = [];
let journalTrendChart = null;
let editingJournalRowIndex = null; // 수정 중인 매매일지 행 인덱스
let autoRefreshEnabled = false;
let currentDisplayRows = [];
let currentDisplayMap = [];

// ===== 서버 자동 재연결 설정 =====
let reconnectTimer = null;        // 재연결 타이머
let reconnectCount = 0;           // 재연결 시도 횟수
const RECONNECT_INTERVAL = 5000;  // 5초마다 재연결 시도
const MAX_RECONNECT = 60;         // 최대 60회 (5분)

// ===== 절전 복귀 감지 =====
// ping 루프 없이 visibilitychange 하나로 처리.
// 사용자가 화면으로 돌아왔을 때, 10분 이상 자리를 비웠으면 데이터 자동 새로고침.
let lastActiveTime = Date.now(); // 마지막으로 페이지가 활성 상태였던 시각
const RESUME_THRESHOLD = 600000; // 10분(600초) 이상 경과 시 절전 복귀로 간주

/**
 * 절전 복귀 감지 - ping 없이 visibilitychange 하나로 처리
 * 사용자가 화면으로 돌아왔을 때 10분 이상 경과했으면 데이터 자동 새로고침
 */
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        // 화면을 떠날 때 시각 기록
        lastActiveTime = Date.now();
    } else if (document.visibilityState === 'visible') {
        const gap = Date.now() - lastActiveTime;
        if (gap > RESUME_THRESHOLD && currentData && currentData._filePath) {
            // 10분 이상 자리 비웠다가 복귀 → 절전 복귀로 간주하고 데이터 새로고침
            console.log(`[절전 복귀] ${Math.round(gap / 60000)}분 경과 → 데이터 새로고침`);
            showToast('🔄 절전 복귀 감지 — 데이터를 새로고침합니다.', 'info');
            loadExcel(currentData._filePath, currentData.current_sheet || null);
        }
    }
});

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', init);



async function init() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('hidden');

    // 키보드 단축키 설정
    document.addEventListener('keydown', (e) => {
        // Ctrl+S: 취소선 토글
        if (e.ctrlKey && e.key.toLowerCase() === 's' && !e.shiftKey && !e.altKey && !e.metaKey) {
            e.preventDefault(); // 기본 저장 동작 방지
            e.stopPropagation(); // 이벤트 버블링 방지

            toggleStrikethrough();
        }
    });

    // 포트폴리오 맵 차트 더블 클릭 이벤트: 매매일지 트렌드로 이동
    const portfolioCanvas = document.getElementById('portfolio-chart');
    if (portfolioCanvas) {
        portfolioCanvas.addEventListener('dblclick', async (evt) => {
            if (!portfolioChart) return;
            // Chart.js API를 통해 클릭된 바(막대)의 정보 가져오기
            const activePoints = portfolioChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (activePoints.length > 0) {
                const firstPoint = activePoints[0];
                const label = portfolioChart.data.labels[firstPoint.index];
                const stockName = Array.isArray(label) ? label.join('') : label;
                const cleanName = stockName.trim();
                
                // 매매일지 시트로 탭 전환
                if (currentData && currentData._filePath) {
                    await loadExcel(currentData._filePath, '매매일지');
                    
                    // 로딩 후 매매일지 트렌드의 셀렉트 박스 값을 변경하고 차트를 업데이트
                    setTimeout(() => {
                        const chartStockSelect = document.getElementById('journal-chart-stock-select');
                        if (chartStockSelect) {
                            chartStockSelect.value = cleanName;
                            updateJournalTrendChart();
                            
                            // 스크롤을 부드럽게 매매일지 차트 쪽으로 이동
                            const chartPanel = document.querySelector('.chart-panel');
                            if (chartPanel) {
                                chartPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }
                    }, 400);
                }
            }
        });
    }

    // 매매일지 자동 투자금 계산 및 반올림 로직
    const quantityInput = document.getElementById('trade-quantity');
    const priceInput = document.getElementById('trade-price');
    const amountInput = document.getElementById('trade-amount');

    const calculateAmount = () => {
        const stockName = String(document.getElementById('trade-stock').value || '').trim();
        const tradeType = document.getElementById('trade-type').value;
        const qty = parseFloat(quantityInput.value) || 0;
        const price = parseFloat(priceInput.value) || 0;

        // 포트폴리오 맵에서 기존 금액(만원 단위) 가져오기
        const baseAmount = portfolioMapCache[stockName] || 0;

        if (qty > 0 && price > 0) {
            // 이번 거래 금액 계산 (만원 단위)
            // 수량 * 단가 / 1,000,000을 반올림하여 백만원 단위 개수 산출 후 100 곱함
            const tradeOnes = Math.round((qty * price) / 1000000);
            const tradeAmount = tradeOnes * 100;

            if (tradeType === '매도') {
                amountInput.value = Math.max(0, baseAmount - tradeAmount);
            } else {
                amountInput.value = baseAmount + tradeAmount;
            }
        } else if (baseAmount > 0) {
            amountInput.value = baseAmount;
        } else {
            amountInput.value = '';
        }
    };

    if (quantityInput && priceInput && amountInput) {
        amountInput.readOnly = true; // 사용자가 직접 수정하지 못하도록 고정

        let calcTimeout;
        const debouncedCalculate = () => {
            clearTimeout(calcTimeout);
            calcTimeout = setTimeout(() => {
                calculateAmount();
                updateJournalTrendChart(); // 차트 업데이트 추가
            }, 100);
        };

        quantityInput.addEventListener('input', debouncedCalculate);
        priceInput.addEventListener('input', debouncedCalculate);
        document.getElementById('trade-stock').addEventListener('input', debouncedCalculate);
        document.getElementById('trade-stock').addEventListener('change', debouncedCalculate);
        document.getElementById('trade-type').addEventListener('change', debouncedCalculate);
    }

    // 매매일지 폼 제출 핸들러
    const journalForm = document.getElementById('journal-form');
    if (journalForm) {
        journalForm.onsubmit = async (e) => {
            e.preventDefault();

            const rowData = [
                document.getElementById('trade-date').value,
                document.getElementById('trade-stock').value,
                parseFloat(document.getElementById('trade-quantity').value) || 0,
                parseFloat(document.getElementById('trade-price').value) || 0,
                document.getElementById('trade-type').value,
                parseFloat(document.getElementById('trade-amount').value) || 0
            ];

            try {
                const isEdit = editingJournalRowIndex !== null;
                const url = isEdit ? `${API}/update-row` : `${API}/save-journal`;
                const body = isEdit ? {
                    file: TARGET_FILE,
                    sheet: '매매일지',
                    rowIndex: editingJournalRowIndex,
                    values: rowData
                } : {
                    file: TARGET_FILE,
                    sheet: '매매일지',
                    row: rowData
                };

                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }

                const result = await res.json();
                if (result.success) {
                    showToast(isEdit ? '매매일지가 수정되었습니다.' : '매매일지가 성공적으로 저장되었습니다.', 'success');
                    resetJournalForm(); // 폼 초기화 및 수정 모드 해제
                    refreshData(true); // 데이터 새로고침
                } else {
                    showToast('저장 실패: ' + result.error, 'error');
                    alert('저장 실패: ' + result.error);
                }
            } catch (err) {
                console.error('Save error:', err);
                showToast('저장 중 오류가 발생했습니다.', 'error');
                alert('저장 중 오류가 발생했습니다.\n서버가 실행 중인지 확인해주세요.\n\n상세: ' + err.message);
            }
        };

        // 리셋 버튼 클릭 시 수정 모드 해제 추가
        journalForm.onreset = () => {
            resetJournalForm();
        };

        // 삭제 버튼 클릭 이벤트 등록
        const deleteBtn = document.getElementById('btn-delete-journal');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', deleteJournalEntry);
        }
    }

    try {
        const res = await fetch(`${API}/onedrive-status`);
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        const badge = document.getElementById('connection-status');

        if (data.connected) {
            badge.className = 'connection-badge connected';
            badge.querySelector('.status-text').textContent = 'OneDrive 연결됨';
            await loadExcel(TARGET_FILE);
        } else {
            badge.className = 'connection-badge disconnected';
            badge.querySelector('.status-text').textContent = '연결 안됨';
            showToast('OneDrive 연결을 확인해주세요.', 'error');
            overlay.classList.add('hidden');
        }
    } catch (e) {
        console.error('Initialization error:', e);
        overlay.classList.add('hidden');

        const badge = document.getElementById('connection-status');
        badge.className = 'connection-badge disconnected';
        badge.querySelector('.status-text').textContent = '서버 연결 중...';

        // 서버가 아직 시작 중일 수 있으므로 자동 재연결 시작
        startReconnectPolling();
    }
}


// ===== 서버 자동 재연결 폴링 =====
function startReconnectPolling() {
    // 이미 실행 중이면 중복 방지
    if (reconnectTimer) return;
    reconnectCount = 0;

    console.log('[재연결] 서버 재연결 폴링 시작...');
    showToast('서버 연결 시도 중... 자동으로 재연결됩니다.', 'info');

    reconnectTimer = setInterval(async () => {
        reconnectCount++;
        const badge = document.getElementById('connection-status');

        // 최대 시도 횟수 초과
        if (reconnectCount > MAX_RECONNECT) {
            clearInterval(reconnectTimer);
            reconnectTimer = null;
            badge.className = 'connection-badge disconnected';
            badge.querySelector('.status-text').textContent = '서버 오프라인';
            showToast('서버에 연결할 수 없습니다. 데이터 로컬 버전을 표시합니다.', 'error');
            console.warn('[재연결] 최대 시도 횟수 초과. 재연결 중단.');
            return;
        }

        // 상태 표시 업데이트
        badge.querySelector('.status-text').textContent = `재연결 중... (${reconnectCount}/${MAX_RECONNECT})`;
        console.log(`[재연결] ${reconnectCount}/${MAX_RECONNECT}회 시도 중...`);

        try {
            if (IS_GITHUB_PAGES) {
                clearInterval(reconnectTimer);
                reconnectTimer = null;
                badge.className = 'connection-badge connected';
                badge.querySelector('.status-text').textContent = 'GitHub 연결됨';
                await loadExcel(TARGET_FILE);
                return;
            }

            const res = await fetch(`${API}/onedrive-status`, { signal: AbortSignal.timeout(3000) });
            const data = await res.json();

            // 연결 성공!
            clearInterval(reconnectTimer);
            reconnectTimer = null;
            reconnectCount = 0;

            console.log('[재연결] 서버 연결 성공!');
            showToast('서버에 연결되었습니다!', 'success');

            if (data.connected) {
                badge.className = 'connection-badge connected';
                badge.querySelector('.status-text').textContent = 'OneDrive 연결됨';
                const overlay = document.getElementById('loading-overlay');
                overlay.classList.remove('hidden');
                await loadExcel(TARGET_FILE);
            } else {
                badge.className = 'connection-badge disconnected';
                badge.querySelector('.status-text').textContent = '연결 안됨';
                showToast('OneDrive 연결을 확인해주세요.', 'error');
            }
        } catch (e) {
            // 아직 서버 미실행 중 - 계속 대기
            console.log(`[재연결] 서버 미응답 (${reconnectCount}회차)`);
        }
    }, RECONNECT_INTERVAL);
}

async function loadExcel(filePath, sheetName = null) {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('hidden');

    // 데이터 로드 전 UI 상태 초기화 (오류 발생 시에도 최소한의 틀 유지)
    const tablePanel = document.getElementById('table-panel');
    const journalPanel = document.getElementById('journal-panel');
    const investigationPanel = document.getElementById('investigation-panel');
    const chartPanel = document.querySelector('.chart-panel');
    
    if (tablePanel) tablePanel.classList.remove('hidden');
    if (journalPanel) journalPanel.classList.add('hidden');
    if (investigationPanel) investigationPanel.classList.add('hidden');
    if (chartPanel) chartPanel.classList.remove('hidden');
    const signalPanel = document.getElementById('signal-panel');
    if (signalPanel) signalPanel.classList.add('hidden');

    try {
        // 캐시 방지를 위해 타임스탬프 추가
        const timestamp = new Date().getTime();
        let url;
        
        if (IS_GITHUB_PAGES) {
            // GitHub Pages 환경: 정적 JSON 파일 로드
            const targetSheet = sheetName || '매매일지'; // 기본값
            const jsonFileName = GITHUB_JSON_MAP[targetSheet];
            if (!jsonFileName) throw new Error(`시트 매핑을 찾을 수 없음: ${targetSheet}`);
            url = `${API}/${jsonFileName}?t=${timestamp}`;
        } else {
            // 로컬 서버 API 호출
            url = `${API}/read-excel?file=${encodeURIComponent(filePath)}&t=${timestamp}`;
            if (sheetName) url += `&sheet=${encodeURIComponent(sheetName)}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
            showToast('파일을 찾을 수 없습니다: ' + TARGET_FILE, 'error');
            return;
        }

        currentData = data;
        currentData._filePath = filePath;

        document.getElementById('row-count-badge').textContent = `${data.row_count}행`;

        // 마지막 수정 시간 표시
        if (data.last_modified) {
            const date = new Date(data.last_modified * 1000);
            const dateStr = date.toLocaleString('ko-KR', {
                month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            const lastUpdatedEl = document.getElementById('last-updated');
            if (lastUpdatedEl) {
                lastUpdatedEl.textContent = `파일 수정: ${dateStr}`;
            }
        }

        renderSheetTabs(data.sheet_names, data.current_sheet);
        renderTable(data);

        // 포트폴리오 맵 데이터 캐싱 업데이트
        if (data.current_sheet === '포트폴리오 맵') {
            updatePortfolioMapCache(data);
        } else if (Object.keys(portfolioMapCache).length === 0) {
            // 캐시가 비어있을 때만 포트폴리오 맵 데이터 요청 (불필요한 중복 API 호출 방지)
            await fetchPortfolioMapData();
        }

        // 탐구생활(매매우선) 데이터 캐싱 업데이트
        if (isExplorationSheet(data.current_sheet)) {
            updateInvestigationPriorityCache(data);
        } else if (investigationPriorityCache.size === 0) {
            await fetchInvestigationPriorityData();
        }
    } catch (e) {
        showToast('데이터 로드 중 오류가 발생했습니다.', 'error');
    } finally {
        overlay.classList.add('hidden');
    }
}

function renderSheetTabs(sheets, activeSheet) {
    const container = document.getElementById('sheet-tabs');
    // '탑쌓기', '카드놀이' 시트 제외
    const filteredSheets = sheets.filter(name => name !== '탑쌓기' && name !== '카드놀이');

    let html = filteredSheets.map(name => `
        <button class="sheet-tab ${name === activeSheet ? 'active' : ''}" 
                onclick="loadExcel('${currentData._filePath}', '${name}')">
            ${name}
        </button>
    `).join('');
    
    // 신호 포착 커스텀 탭 추가
    html += `
        <button class="sheet-tab ${activeSheet === '신호 포착' ? 'active' : ''}" 
                onclick="loadSignalTab()">
            신호 포착
        </button>
    `;
    container.innerHTML = html;
}

async function loadSignalTab() {
    if (!currentData) return;
    
    // UI 업데이트 (탭 활성화)
    renderSheetTabs(currentData.sheet_names, '신호 포착');
    
    // 패널 가시성 전환
    const tablePanel = document.getElementById('table-panel');
    const journalPanel = document.getElementById('journal-panel');
    const investigationPanel = document.getElementById('investigation-panel');
    const chartPanel = document.querySelector('.chart-panel');
    const signalPanel = document.getElementById('signal-panel');

    if (tablePanel) tablePanel.classList.add('hidden');
    if (journalPanel) journalPanel.classList.add('hidden');
    if (investigationPanel) investigationPanel.classList.add('hidden');
    if (chartPanel) chartPanel.classList.add('hidden');
    if (signalPanel) signalPanel.classList.remove('hidden');
    
    // 캐시가 비어있을 경우 한번 로드 시도
    if (investigationPriorityCache.size === 0) {
        await fetchInvestigationPriorityData();
    }
    
    await refreshSignalPrices();
}

let currentSignalCategory = 'portfolio';

window.setSignalCategory = function(category) {
    currentSignalCategory = category;
    
    document.getElementById('btn-sig-portfolio').classList.remove('active');
    document.getElementById('btn-sig-priority').classList.remove('active');
    document.getElementById('btn-sig-market').classList.remove('active');
    
    if (category === 'portfolio') {
        document.getElementById('btn-sig-portfolio').classList.add('active');
    } else if (category === 'priority') {
        document.getElementById('btn-sig-priority').classList.add('active');
    } else if (category === 'market') {
        document.getElementById('btn-sig-market').classList.add('active');
    }
    
    refreshSignalPrices();
};



async function refreshSignalPrices(forceUpdate = false) {
    const tbody = document.getElementById('signal-table-body');
    if (!tbody) return;

    let stocks = [];
    if (currentSignalCategory === 'portfolio') {
        stocks = Object.keys(portfolioMapCache).filter(name => name && name.trim()).map(name => name.trim());
    } else if (currentSignalCategory === 'priority') {
        // 매매우선 종목은 탐구생활 시트에서 추출된 캐시 사용
        stocks = [...investigationPriorityCache].filter(name => name && name.trim()).map(name => name.trim());
    } else if (currentSignalCategory === 'market') {
        window.foreignDiffsCache = {};
        // 시장관심종목 (네이버 인기 검색어 매칭 + 외인 변동폭 Top 5)
        if (IS_GITHUB_PAGES) {
            try {
                const ts = new Date().getTime();
                const res = await fetch(`StockPortfolioApp/public/data/market_interest_stocks.json?t=${ts}`);
                if (res.ok) {
                    const result = await res.json();
                    stocks = result.stocks || [];
                    window.foreignDiffsCache = result.foreign_diffs || {};
                }
            } catch (e) {
                console.error('시장관심종목 로컬 JSON 로드 실패:', e);
            }
        } else {
            try {
                // Flask API 호출을 통해 실시간 수집 및 비교
                const res = await fetch(`${API}/market-interest-stocks`);
                if (res.ok) {
                    const result = await res.json();
                    if (result.success) {
                        stocks = result.stocks || [];
                        window.foreignDiffsCache = result.foreign_diffs || {};
                    }
                }
            } catch (e) {
                console.error('시장관심종목 API 조회 실패:', e);
                showToast('시장관심종목 실시간 조회 실패. 이전 캐시를 불러옵니다.', 'error');
                
                // Fallback: 로컬 JSON 파일에서 읽기
                try {
                    const res = await fetch(`data/market_interest_stocks.json`);
                    if (res.ok) {
                        const result = await res.json();
                        stocks = result.stocks || [];
                        window.foreignDiffsCache = result.foreign_diffs || {};
                    }
                } catch (fallbackErr) {}
            }
        }
    }
    
    // 중복 제거
    stocks = [...new Set(stocks)];

    if (stocks.length === 0) {
        let emptyMsg = '종목이 없습니다.';
        if (currentSignalCategory === 'portfolio') emptyMsg = '등록된 포트폴리오 종목이 없습니다.';
        else if (currentSignalCategory === 'priority') emptyMsg = '등록된 매매우선 종목이 없습니다.';
        else if (currentSignalCategory === 'market') emptyMsg = '현재 시장관심 30위 내에 탐구생활 종목이 없습니다.';
        
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">${emptyMsg}</td></tr>`;
        return;
    }
    
    // 목표가 및 시점 정보 로드
    window.targetPricesCache = window.targetPricesCache || {};
    window.targetDatesCache = window.targetDatesCache || {};
    try {
        const [resTarget, resDate] = await Promise.all([
            fetch(`${API}/target-prices`),
            fetch(`${API}/target-dates`)
        ]);
        if (resTarget.ok) {
            window.targetPricesCache = await resTarget.json();
        }
        if (resDate.ok) {
            window.targetDatesCache = await resDate.json();
        }
    } catch(e) {
        console.warn('목표가/시점 로드 실패', e);
    }
    
    // 1. 기본 테이블 생성
    let html = '';
    for (const stock of stocks) {
        // 종목명에서 공백 등을 제거하여 안전한 ID 생성
        const safeId = stock.replace(/[^a-zA-Z0-9가-힣]/g, '');
        
        let nameHtml = stock;
        if (currentSignalCategory === 'market' && window.foreignDiffsCache && window.foreignDiffsCache[stock] !== undefined) {
            const diffVal = window.foreignDiffsCache[stock];
            const color = diffVal > 0 ? '#00F2FE' : '#EF4444';
            const sign = diffVal > 0 ? '+' : '';
            nameHtml = `${stock}<br><span style="font-size:11px; font-weight:normal; color:${color};">(외인 ${sign}${diffVal.toFixed(2)}%p)</span>`;
        }
        
        // 기존 row를 재활용하거나 새로 생성
        html += `
            <tr id="signal-row-${safeId}">
                <td style="font-weight:bold; color:var(--gold-light);">${nameHtml}</td>
                <td class="col-price">-</td>
                <td class="col-target">
                    <input type="text" class="target-price-input" data-stock="${stock}" value="${window.targetPricesCache[stock] ? window.targetPricesCache[stock].toLocaleString() : ''}" oninput="this.value = this.value.replace(/[^0-9]/g, '').replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')" onchange="saveTargetPrice('${stock}', this.value)" style="width:80px; text-align:right; background:rgba(0,0,0,0.2); border:1px solid #444; color:#00F2FE; border-radius:4px; padding:4px;">
                </td>
                <td class="col-date">
                    <input type="${window.targetDatesCache[stock] ? 'date' : 'text'}" class="target-date-input" data-stock="${stock}" value="${window.targetDatesCache[stock] || ''}" onfocus="this.type='date'" onblur="if(!this.value) this.type='text'" onchange="saveTargetDate('${stock}', this.value)" placeholder="" style="width:125px; background:rgba(0,0,0,0.2); border:1px solid #444; color:#00F2FE; border-radius:4px; padding:4px;">
                </td>
                <td class="col-ma5-cur"><div class="spinner" style="display:inline-block;width:14px;height:14px;vertical-align:middle;border-width:2px;"></div></td>
                <td class="col-ma5-next">-</td>
                <td class="col-ma120-week">-</td>
                <td class="col-rsi">-</td>
            </tr>`;
    }
    tbody.innerHTML = html;
    showToast(forceUpdate ? '데이터 강제 갱신을 시작합니다.' : '현재가 및 이동평균선 조회를 시작합니다.', 'info');
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 2. 개별 종목별로 비동기 MA 조회 (실패 시 자동 재시도 포함)
    let pendingStocks = [...stocks];
    let retryCount = 0;
    const MAX_RETRIES = 10;
    
    // localStorage 캐시 프리로드 (루프 내 동기 I/O 최소화)
    const signalCacheMap = new Map();
    if (!forceUpdate) {
        for (const stock of stocks) {
            const cacheKey = `signalData_${stock}`;
            try {
                const stored = localStorage.getItem(cacheKey);
                if (stored) signalCacheMap.set(stock, JSON.parse(stored));
            } catch(e) {}
        }
    }
    while (pendingStocks.length > 0 && retryCount < MAX_RETRIES) {
        if (retryCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            showToast(`조회 지연 종목 ${pendingStocks.length}개 재시도 중... (${retryCount}/${MAX_RETRIES}회차)`, 'info');
        }
        
        const nextPending = [];
        
        for (const stock of pendingStocks) {
            const safeId = stock.replace(/[^a-zA-Z0-9가-힣]/g, '');
            const row = document.getElementById(`signal-row-${safeId}`);
            if (!row) continue;
            
            try {
                const cacheKey = `signalData_${stock}`;
                let data = null;
                const todayStr = new Date().toISOString().split('T')[0];
                
                if (!forceUpdate) {
                    const cached = signalCacheMap.get(stock);
                    if (cached && cached.date === todayStr) {
                        data = cached.data;
                    }
                }
                
                if (!data) {
                    const res = await fetch(`${API}/ls/moving-averages?name=${encodeURIComponent(stock)}`);
                    if (res.status === 400) {
                        console.warn(`조회 불가능한 종목명: ${stock}`);
                        row.querySelector('.col-price').innerHTML = '<span style="color:#888;">조회 불가</span>';
                        row.querySelectorAll('td.col-ma5-cur, td.col-ma5-next, td.col-ma120-week, td.col-rsi').forEach(td => td.innerText = '-');
                        continue;
                    }
                    if (!res.ok) throw new Error('API Error');
                    const result = await res.json();
                    
                    if (result.success && result.data && result.data.current) {
                        data = result.data;
                        try {
                            localStorage.setItem(cacheKey, JSON.stringify({ date: todayStr, data: data }));
                        } catch(e) {}
                    }
                }
                
                if (data && data.current) {
                    const current = data.current;
                    const ma5_month = data.ma5_month || 0;
                    
                    // 현재가 표시
                    row.querySelector('.col-price').innerHTML = `<span style="color:var(--highlight); font-weight:bold;">${current.toLocaleString()}원</span>`;
                    
                    let ma5CurHtml = '<span style="color:#555;">-</span>';
                    let ma5NextHtml = '<span style="color:#555;">-</span>';
                    let ma120Html = '<span style="color:#555;">-</span>';
                    let rsiHtml = '<span style="color:#555;">-</span>';
                    
                    // 목표가 도달 체크
                    const tp = window.targetPricesCache && window.targetPricesCache[stock];
                    let isTargetReached = false;
                    if (tp) {
                        const high_1w = data.high_1w || current;
                        const low_1w = data.low_1w || current;
                        if (current <= tp || (high_1w >= tp && low_1w <= tp)) {
                            isTargetReached = true;
                        }
                    }
                    
                    if (isTargetReached) {
                        let nameHtml = stock;
                        if (window.foreignDiffsCache && window.foreignDiffsCache[stock] !== undefined) {
                            const diffVal = window.foreignDiffsCache[stock];
                            const color = diffVal > 0 ? '#00F2FE' : '#EF4444';
                            const sign = diffVal > 0 ? '+' : '';
                            nameHtml = `${stock}<br><span style="font-size:11px; font-weight:normal; color:${color};">(외인 ${sign}${diffVal.toFixed(2)}%p)</span>`;
                        }
                        row.querySelector('td:first-child').innerHTML = `${nameHtml}<br><span style="color:var(--danger); font-size:11px; font-weight:bold;">🚨 목표가 도달</span>`;
                        row.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                        row.style.borderLeft = '3px solid var(--danger)';
                    }
                    
                    if (ma5_month > 0) {
                        const ma5_month_next = data.ma5_month_next || ma5_month;
                        
                        if (current < ma5_month_next && !isTargetReached) {
                            row.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                            row.style.borderLeft = '3px solid var(--danger)';
                        }
                        
                        if (current < ma5_month) {
                            const diffCur = Math.abs(((current - ma5_month) / ma5_month) * 100);
                            ma5CurHtml = `<span style="color:var(--danger); font-weight:bold; font-size:12px;">${diffCur.toFixed(1)}% 하회</span>`;
                        }
                        
                        if (current < ma5_month_next) {
                            const diffNext = Math.abs(((current - ma5_month_next) / ma5_month_next) * 100);
                            ma5NextHtml = `<span style="color:var(--danger); font-weight:bold; font-size:12px;">${diffNext.toFixed(1)}% 하회</span>`;
                        }
                    }
                    
                    const ma120_week = data.ma120_week || 0;
                    if (ma120_week > 0) {
                        const diff120Raw = ((current - ma120_week) / ma120_week) * 100;
                        const diff120Abs = Math.abs(diff120Raw);
                        
                        // 0% ~ 5% 이내로 근접한 경우만 표기
                        if (diff120Abs <= 5.0) {
                            if (diff120Raw < 0) {
                                ma120Html = `<span style="color:var(--danger); font-weight:bold; font-size:12px;">${diff120Abs.toFixed(1)}% 하회</span>`;
                            } else {
                                ma120Html = `<span style="color:var(--danger); font-weight:bold; font-size:12px;">${diff120Abs.toFixed(1)}% 상회</span>`;
                            }
                            // 120주선 조건 만족 시 행 전체 붉은색 강조
                            if (!isTargetReached) {
                                row.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                                row.style.borderLeft = '3px solid var(--danger)';
                            }
                        }
                    }
                    
                    const rsiD = data.rsi_day || 0;
                    const rsiW = data.rsi_week || 0;
                    const rsiM = data.rsi_month || 0;
                    
                    let rsiTexts = [];
                    if (rsiD > 0 && rsiD <= 30) rsiTexts.push(`일:${rsiD}`);
                    if (rsiW > 0 && rsiW <= 30) rsiTexts.push(`주:${rsiW}`);
                    if (rsiM > 0 && rsiM <= 30) rsiTexts.push(`월:${rsiM}`);
                    
                    if (rsiTexts.length > 0) {
                        rsiHtml = `<span style="color:var(--danger); font-weight:bold; font-size:12px;">${rsiTexts.join(', ')}</span>`;
                    }
                    
                    // 기존 컬럼 업데이트
                    row.querySelector('.col-ma5-cur').innerHTML = ma5CurHtml;
                    row.querySelector('.col-ma5-next').innerHTML = ma5NextHtml;
                    row.querySelector('.col-ma120-week').innerHTML = ma120Html;
                    row.querySelector('.col-rsi').innerHTML = rsiHtml;
                } else {
                    // 오류/조회불가 상태에 대한 재시도 로직
                    nextPending.push(stock);
                    row.querySelector('.col-ma5-cur').innerHTML = '<span style="color:gray; font-size:12px;">조회 지연 (대기중)</span>';
                }
            } catch (e) {
                console.error(`MA fetch error for ${stock}:`, e);
                nextPending.push(stock);
                row.querySelector('.col-ma5-cur').innerHTML = '<span style="color:gray; font-size:12px;">오류 (재시도)</span>';
            }
        }
        
        pendingStocks = nextPending;
        retryCount++;
    }
    
    // 최대 재시도 후에도 남은 종목은 최종 조회 불가 처리
    for (const stock of pendingStocks) {
        const safeId = stock.replace(/[^a-zA-Z0-9가-힣]/g, '');
        const row = document.getElementById(`signal-row-${safeId}`);
        if (!row) continue;
        row.querySelector('.col-ma5-cur').innerHTML = '<span style="color:gray; font-size:12px;">최종 조회 불가</span>';
        row.querySelector('.col-ma5-next').innerHTML = '-';
        row.querySelector('.col-ma120-week').innerHTML = '-';
        row.querySelector('.col-rsi').innerHTML = '-';
    }
}

let portfolioChart = null;

const INVESTIGATION_STICKY_HEADERS = ['번호', '종목명', '질문', '모델명', '모델', '매수 이유', '리스크', '대표', '매매 전략'];

function getInvestigationStickyIndices(columns) {
    const lowerHeaders = columns.map(c => String(mapColumnLabel(c) || '').toLowerCase());
    const index = lowerHeaders.findIndex(c => INVESTIGATION_STICKY_HEADERS.some(key => c.includes(key.toLowerCase())));
    if (index !== -1) {
        return Array.from({ length: Math.min(8, columns.length - index) }, (_, idx) => index + idx);
    }
    return Array.from({ length: Math.min(8, columns.length) }, (_, idx) => idx);
}

function renderTable(data) {
    try {
        const thead = document.getElementById('table-head');
        const stickyCols = getInvestigationStickyIndices(data.columns);
        thead.innerHTML = `<tr>${data.columns.map((c, idx) => {
            const stickyIndex = stickyCols.indexOf(idx);
            const className = stickyIndex !== -1 ? `sticky-col-${stickyIndex + 1}` : '';
            return `<th class="${className}">${mapColumnLabel(c)}</th>`;
        }).join('')}</tr>`;
        renderTableRows(data.data, data.columns);
        renderChart(data);
    } catch (e) {
        console.error('Table rendering error:', e);
        showToast('테이블을 표시하는 중 오류가 발생했습니다.', 'error');
    }
}

function renderChart(data) {
    const ctx = document.getElementById('portfolio-chart');
    if (!ctx) return;

    // 차트 제목 업데이트
    const chartTitle = document.querySelector('.chart-header h3');
    if (chartTitle) {
        const svgIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`;
        if (data.current_sheet === '실적') {
            chartTitle.innerHTML = `${svgIcon} 실적 지표`;
        } else {
            chartTitle.innerHTML = `${svgIcon} 포트폴리오 분석 그래프`;
        }
    }

    const controls = document.getElementById('chart-controls');
    const chartPanel = document.querySelector('.chart-panel');
    const journalPanel = document.getElementById('journal-panel');
    const tablePanel = document.getElementById('table-panel');

    // 현금 패널은 기본적으로 숨기고, 포트폴리오 맵에서만 표시
    const cashPanel = document.getElementById('cash-panel');
    if (cashPanel) cashPanel.style.display = 'none';

    if (data.current_sheet === '매매일지') {
        if (chartPanel) chartPanel.classList.add('hidden');
        if (journalPanel) journalPanel.classList.remove('hidden');
        if (tablePanel) tablePanel.classList.add('hidden'); // 테이블 표시 추가
        const investigationPanel = document.getElementById('investigation-panel');
        if (investigationPanel) investigationPanel.classList.add('hidden');

        // 종목명 추천 목록(datalist) 업데이트
        const datalist = document.getElementById('stock-list');
        const chartStockSelect = document.getElementById('journal-chart-stock-select');
        
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const stocks = new Set();

        data.data.forEach(row => {
            const dateStr = row['Unnamed: 0'];
            const stockName = row['Unnamed: 1'];
            if (dateStr && stockName) {
                const rowDate = new Date(dateStr);
                const sName = String(stockName).trim();
                // 6개월 이내이고 유효한 종목명인 경우만 수집
                if (!isNaN(rowDate) && rowDate >= sixMonthsAgo && sName && sName !== '종목' && sName !== 'stock') {
                    stocks.add(sName);
                }
            }
        });

        const sortedStocks = Array.from(stocks).sort();

        if (datalist) {
            datalist.innerHTML = sortedStocks
                .map(stock => `<option value="${stock}">`)
                .join('');
        }
        
        // 매매일지 전용 종목 선택기(차트용) 업데이트
        if (chartStockSelect) {
            const currentSelected = chartStockSelect.value;
            chartStockSelect.innerHTML = '<option value="">종목 선택...</option>' + 
                `<option value="총합" ${currentSelected === '총합' ? 'selected' : ''}>총합</option>` +
                sortedStocks.map(s => `<option value="${s}" ${s === currentSelected ? 'selected' : ''}>${s}</option>`).join('');
            
            chartStockSelect.onchange = () => updateJournalTrendChart();
        }

        // 입력 폼 종목 변경 시 차트도 따라가게 함 (input 이벤트로 즉시 반영)
        const tradeStockInput = document.getElementById('trade-stock');
        if (tradeStockInput) {
            const updateLogic = (e) => {
                const val = e.target.value.trim();
                if (chartStockSelect && val) {
                    // 드롭다운에 해당 종목이 있으면 선택, 없으면 그냥 차트 업데이트 시도
                    chartStockSelect.value = val;
                    updateJournalTrendChart();
                }
            };
            tradeStockInput.oninput = updateLogic;
            tradeStockInput.onchange = updateLogic;
        }

        // 매매일지 진입 시 차트 초기화/업데이트
        updateJournalTrendChart();
        return;
    }

    if (isExplorationSheet(data.current_sheet)) {
        if (chartPanel) chartPanel.classList.add('hidden');
        if (journalPanel) journalPanel.classList.add('hidden');
        if (tablePanel) tablePanel.classList.add('hidden');
        renderInvestigationPanel(data);
        return;
    } else {
        if (chartPanel) chartPanel.classList.remove('hidden');
        if (journalPanel) journalPanel.classList.add('hidden');
        if (tablePanel) tablePanel.classList.remove('hidden');
        const investigationPanel = document.getElementById('investigation-panel');
        if (investigationPanel) investigationPanel.classList.add('hidden');
    }

    if (data.current_sheet === '포트폴리오 맵') {
        if (tablePanel) tablePanel.classList.add('hidden');
        controls.innerHTML = '<span class="badge">전체 투자 현황 (합산)</span>';
        // 현금 패널 표시
        const cashPanel = document.getElementById('cash-panel');
        if (cashPanel) cashPanel.style.display = 'block';
        updateChart(data, null);
        return;
    }

    if (data.current_sheet === '실적') {
        if (tablePanel) tablePanel.classList.add('hidden');
        
        const perfCols = data.numeric_columns.filter(c => 
            ['수익', '수익율', 'BM 대비 수익율', '배당수익'].includes(c)
        );
        const defaultCol = '누적 수익'; 
        
        controls.innerHTML = `
            <span class="badge" style="margin-right:10px;">연도별 실적 분석</span>
            <select id="chart-col-select" class="chart-select">
                <option value="누적 수익" selected>누적 수익 (선)</option>
                ${data.numeric_columns.map(col => `<option value="${col}">${col}</option>`).join('')}
            </select>
        `;
        const select = document.getElementById('chart-col-select');
        select.onchange = (e) => updateChart(data, e.target.value);
        updateChart(data, defaultCol);
        return;
    }

    const numericCols = data.numeric_columns || [];
    if (numericCols.length === 0) {
        controls.innerHTML = '<span class="text-muted" style="font-size:12px;">숫자 데이터가 없습니다.</span>';
        if (portfolioChart) {
            portfolioChart.destroy();
            portfolioChart = null;
        }
        return;
    }

    controls.innerHTML = `
        <select id="chart-col-select" class="chart-select">
            ${numericCols.map(col => `<option value="${col}">${col}</option>`).join('')}
        </select>
    `;

    const select = document.getElementById('chart-col-select');
    select.onchange = (e) => updateChart(data, e.target.value);
    updateChart(data, numericCols[0]);
}


function updateChart(data, columnName) {
    const ctx = document.getElementById('portfolio-chart').getContext('2d');

    let labels = [];
    let values = [];
    let backgroundColors = [];
    let borderColors = [];
    let labelName = columnName;

    let totalOpAmount = 0;
    let totalExAmount = 0;
    let groupTotals = {}; // { sector: { op: 0, ex: 0, total: 0 } }
    let tempData = [];

    if (data.current_sheet === '실적') {
        // 실적 탭에서는 투자 요약 바 숨김
        const summaryStats = document.querySelector('.summary-stats');
        if (summaryStats) summaryStats.classList.add('hidden');

        const yearCol = data.columns.find(c => c.includes('연도')) || data.columns[0];
        const profitCol = '수익';
        const yieldCol = '수익율';

        // 단위 결정 함수를 상단으로 이동 (Hoisting 이슈 해결)
        const getUnit = (name) => {
            if (name.includes('수익율') || name.includes('BM') || name.includes('대비') || name.includes('코스피') || name.includes('비율')) return '%';
            if (name.includes('수익') || name.includes('자산') || name.includes('투자금') || name.includes('금액')) return 'M';
            return '';
        };
        
        let cumulativeSum = 0;
        const isCumulative = columnName === '누적 수익';
        const targetCol = isCumulative ? profitCol : columnName;
        
        let yearlyProfits = []; 
        let yearlyYields = []; 

        data.data.forEach(row => {
            const year = row[yearCol];
            let val = row[targetCol];
            let numVal = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
            
            const yearStr = String(year || '').trim();
            const isSummaryRow = yearStr.includes('계') || yearStr.includes('평균') || 
                              yearStr.includes('최근') || yearStr.includes('총합') || 
                              yearStr.includes('합계') || yearStr === '';
            
            if (!isSummaryRow && !isNaN(numVal)) {
                if (isCumulative) {
                    let currentProfit = typeof row[profitCol] === 'number' ? row[profitCol] : parseFloat(String(row[profitCol]).replace(/,/g, '')) || 0;
                    let currentYield = typeof row[yieldCol] === 'number' ? row[yieldCol] : parseFloat(String(row[yieldCol]).replace(/,/g, '')) || 0;
                    
                    cumulativeSum += currentProfit;
                    values.push(cumulativeSum);
                    yearlyProfits.push(currentProfit);
                    yearlyYields.push(currentYield);
                } else {
                    // % 단위인 경우 자동으로 100을 곱해줌 (0.12 -> 12)
                    if (getUnit(columnName) === '%' && Math.abs(numVal) < 2) {
                        numVal = numVal * 100;
                    }
                    values.push(numVal);
                }
                
                labels.push(yearStr);
                
                if (numVal >= 0) {
                    backgroundColors.push('rgba(16, 185, 129, 0.4)');
                    borderColors.push('rgba(16, 185, 129, 0.8)');
                } else {
                    backgroundColors.push('rgba(239, 68, 68, 0.4)');
                    borderColors.push('rgba(239, 68, 68, 0.8)');
                }
            }
        });

        if (portfolioChart) portfolioChart.destroy();
        
        const isMixed = isCumulative;

        const dataLabelsPlugin = {
            id: 'dataLabelsPlugin',
            afterDatasetsDraw: (chart) => {
                const { ctx } = chart;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.font = 'bold 11px JetBrains Mono';

                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((datapoint, index) => {
                        const value = dataset.data[index];
                        const unit = getUnit(dataset.label);
                        let label = '';
                        
                        if (isMixed && i === 0) {
                            const profitM = (value / 1000000).toFixed(1);
                            const yieldVal = yearlyYields[index];
                            const yieldP = (yieldVal * 100).toFixed(1);
                            label = `${profitM}M / ${yieldP}%`;
                            ctx.fillStyle = '#94A3B8';
                        } else {
                            if (unit === 'M') {
                                label = `${(value / 1000000).toFixed(1)}M`;
                            } else if (unit === '%') {
                                label = `${value.toFixed(1)}%`;
                            } else {
                                label = value.toLocaleString();
                            }
                            ctx.fillStyle = dataset.borderColor;
                        }
                        
                        const yOffset = (dataset.type === 'line') ? -18 : -8;
                        ctx.fillText(label, datapoint.x, datapoint.y + yOffset);
                    });
                });
                ctx.restore();
            }
        };

        const datasets = [];
        if (isMixed) {
            datasets.push({
                type: 'bar',
                label: '연도별 수익',
                data: yearlyProfits,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1,
                borderRadius: 4,
                yAxisID: 'y',
                order: 2
            });
            datasets.push({
                type: 'line',
                label: '누적 수익',
                data: values,
                borderColor: '#D4AF37',
                backgroundColor: 'transparent',
                borderWidth: 3,
                fill: false,
                tension: 0.3,
                pointRadius: 5,
                pointBackgroundColor: '#D4AF37',
                yAxisID: 'y1',
                order: 1
            });
        } else {
            datasets.push({
                type: 'bar',
                label: columnName,
                data: values,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1,
                borderRadius: 4,
                yAxisID: 'y'
            });
        }

        portfolioChart = new Chart(ctx, {
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: isMixed, labels: { color: '#94A3B8', font: { size: 12, weight: 'bold' } } },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (ctx) => {
                                let val = ctx.parsed.y;
                                let label = ctx.dataset.label || '';
                                const unit = getUnit(label);
                                if (unit === 'M') {
                                    return `${label}: ${val.toLocaleString()} (${(val / 1000000).toFixed(1)}백만)`;
                                } else if (unit === '%') {
                                    return `${label}: ${val.toFixed(2)}%`;
                                }
                                return `${label}: ${val.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: { 
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true, 
                        title: { display: true, text: `단위: ${getUnit(columnName) === 'M' ? '백만(M)' : '퍼센트(%)'}`, color: '#94A3B8', font: { size: 12, weight: 'bold' } },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }, 
                        ticks: { 
                            color: '#94A3B8',
                            font: { size: 11 },
                            callback: (val) => {
                                const unit = getUnit(columnName);
                                if (unit === 'M') return `${(val / 1000000).toFixed(0)}M`;
                                return `${val}%`;
                            }
                        } 
                    },
                    y1: {
                        type: 'linear',
                        display: isMixed,
                        position: 'right',
                        beginAtZero: false,
                        title: { display: true, text: '누적 수익 (M)', color: '#D4AF37', font: { size: 12, weight: 'bold' } },
                        grid: { drawOnChartArea: false }, 
                        ticks: {
                            color: '#D4AF37',
                            font: { size: 11 },
                            callback: (val) => `${(val / 1000000).toFixed(0)}M`
                        }
                    },
                    x: { 
                        grid: { display: false }, 
                        ticks: { color: '#94A3B8', font: { size: 11, weight: 'bold' } } 
                    }
                }
            },
            plugins: [dataLabelsPlugin]
        });
        return;
    }

    if (data.current_sheet === '포트폴리오 맵') {
        labelName = '전략/종목군별 투자 금액 (백만)';
        if (data.data.length < 2) return;

        const dataRows = data.data.slice(1);
        const stockCol = 'Unnamed: 3';
        const strategyCol = 'Unnamed: 1';
        const sectorCol = 'Unnamed: 2';
        const startColIndex = data.columns.indexOf('Unnamed: 4');
        const amountCols = startColIndex !== -1 ? data.columns.slice(startColIndex) : [];

        const sortedRows = [...dataRows].sort((a, b) => {
            const stratA = String(a[strategyCol] || '');
            const stratB = String(b[strategyCol] || '');
            const sectA = String(a[sectorCol] || '');
            const sectB = String(b[sectorCol] || '');

            if (stratA === '운영' && stratB !== '운영') return -1;
            if (stratA !== '운영' && stratB === '운영') return 1;
            return sectA.localeCompare(sectB);
        });

        sortedRows.forEach(row => {
            const stockName = row[stockCol];
            const strategy = row[strategyCol];
            const sector = row[sectorCol] || '기타';

            if (stockName && String(stockName).trim() && stockName !== '종목') {
                let countOfOnes = 0;
                amountCols.forEach(col => {
                    if (parseFloat(row[col]) === 1) countOfOnes++;
                });

                if (countOfOnes > 0) {
                    const rowAmount = countOfOnes; // 1칸당 100만원 -> 1백만 단위로 처리
                    if (!groupTotals[sector]) groupTotals[sector] = { op: 0, ex: 0, total: 0 };
                    groupTotals[sector].total += rowAmount;
                    if (strategy === '운영') groupTotals[sector].op += rowAmount;
                    else groupTotals[sector].ex += rowAmount;

                    values.push(rowAmount);
                    tempData.push({ name: stockName, sector: sector, strategy: strategy, amount: rowAmount });

                    if (strategy === '운영') {
                        totalOpAmount += rowAmount;
                        backgroundColors.push('rgba(212, 175, 55, 0.6)');
                        borderColors.push('rgba(212, 175, 55, 1)');
                    } else {
                        totalExAmount += rowAmount;
                        backgroundColors.push('rgba(148, 163, 184, 0.4)');
                        borderColors.push('rgba(148, 163, 184, 1)');
                    }
                }
            }
        });

        labels = tempData.map(d => {
            if (d.name.length > 5) return [d.name.slice(0, 5), d.name.slice(5)];
            return d.name;
        });

        const totalInvestment = totalOpAmount + totalExAmount;
        document.getElementById('stat-total').textContent = totalInvestment.toLocaleString();
        document.getElementById('stat-stock-count').textContent = values.length;
        document.getElementById('stat-operating').textContent = totalOpAmount.toLocaleString();
        document.getElementById('stat-excluding').textContent = totalExAmount.toLocaleString();
        
        // 단위 텍스트 업데이트 (만원 -> 백만)
        document.querySelectorAll('.summary-stats .stat-unit').forEach(el => el.textContent = '백만');

        const groupStatsContainer = document.getElementById('group-stats');
        if (groupStatsContainer) groupStatsContainer.style.display = 'none';

        if (totalInvestment > 0) {
            document.getElementById('stat-operating-ratio').textContent = `(${(totalOpAmount / totalInvestment * 100).toFixed(1)}%)`;
            document.getElementById('stat-excluding-ratio').textContent = `(${(totalExAmount / totalInvestment * 100).toFixed(1)}%)`;
        }

        // 현금 및 전체 자산 Summary 업데이트
        const totalCash = getTotalCash(); // 백만 단위
        const effectiveInvestment = getEffectiveInvestment(); // 계좌 입력이 있으면 그것, 미입력이면 totalInvestment
        const totalAsset = effectiveInvestment + totalCash; // 백만 단위
        document.getElementById('stat-cash').textContent = totalCash.toLocaleString();
        document.getElementById('stat-total-asset').textContent = totalAsset.toLocaleString();
        if (totalAsset > 0) {
            document.getElementById('stat-cash-ratio').textContent = `(${(totalCash / totalAsset * 100).toFixed(1)}%)`;
        } else {
            document.getElementById('stat-cash-ratio').textContent = '(0%)';
        }

        document.querySelector('.summary-stats').classList.remove('hidden');
        // 현금 계좌 및 투자금 계좌 목록 렌더링
        renderCashAccounts();
        renderInvestAccounts();

        const avgValue = values.length > 0 ? totalInvestment / values.length : 0;

        // 평균 이상 강조를 위한 데이터 저장 (공백 제거 처리)
        currentData._avgAmount = avgValue;
        currentData._calculatedAmounts = tempData.reduce((acc, d) => {
            const nameKey = String(d.name || '').trim();
            if (nameKey) acc[nameKey] = d.amount;
            return acc;
        }, {});

        // 4. 커스텀 플러그인: 종목군 분리선 및 하단 정보 (전략 구역별 금액 분리 표기)
        const sectorGroupPlugin = {
            id: 'sectorGroupPlugin',
            afterDraw: (chart) => {
                const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
                ctx.save();

                let lastGroupKey = null;
                const groups = [];

                // 전략(운용/편출) + 섹터 조합으로 그룹 식별
                tempData.forEach((d, i) => {
                    const groupKey = `${d.strategy}_${d.sector}`;
                    if (groupKey !== lastGroupKey) {
                        groups.push({
                            sector: d.sector,
                            strategy: d.strategy,
                            start: i,
                            end: i,
                            amount: d.amount
                        });
                        lastGroupKey = groupKey;
                    } else {
                        groups[groups.length - 1].end = i;
                        groups[groups.length - 1].amount += d.amount;
                    }
                });

                groups.forEach((g, i) => {
                    const startX = x.getPixelForValue(labels[g.start]) - (x.width / labels.length / 2);
                    const endX = x.getPixelForValue(labels[g.end]) + (x.width / labels.length / 2);

                    if (i > 0) { // 분리선
                        ctx.beginPath();
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                        ctx.setLineDash([5, 5]);
                        ctx.moveTo(startX, top);
                        ctx.lineTo(startX, bottom + 50);
                        ctx.stroke();
                    }

                    const centerX = (startX + endX) / 2;
                    ctx.textAlign = 'center';

                    // 1행: 섹터명
                    ctx.font = 'bold 11px Inter';
                    ctx.fillStyle = '#D4AF37';
                    ctx.fillText(g.sector, centerX, bottom + 55);

                    // 2행 & 3행: 전략 및 금액 줄바꿈 처리 (겹침 방지)
                    ctx.font = '9px JetBrains Mono';
                    ctx.fillStyle = g.strategy === '운영' ? '#D4AF37' : '#94A3B8';
                    const prefix = g.strategy === '운영' ? '운용:' : '편출:';

                    ctx.fillText(prefix, centerX, bottom + 70); // 전략 (운용/편출)
                    const ratio = totalInvestment > 0 ? (g.amount / totalInvestment * 100).toFixed(1) : '0.0';
                    ctx.fillText(`${g.amount.toLocaleString()}백만 (${ratio}%)`, centerX, bottom + 82); // 금액 + 비중
                });
                ctx.restore();
            }
        };

        if (portfolioChart) portfolioChart.destroy();
        portfolioChart = new Chart(ctx, {
            data: {
                labels: labels,
                datasets: [
                    { type: 'bar', label: labelName, data: values, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1, borderRadius: 4, order: 2 },
                    { type: 'line', label: '평균', data: Array(labels.length).fill(avgValue), borderColor: 'rgba(239, 68, 68, 0.6)', borderWidth: 2, borderDash: [5, 5], pointRadius: 0, fill: false, order: 1 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { bottom: 85 } }, // 줄바꿈을 위해 여백 추가 확보
                plugins: {
                    legend: { display: true, labels: { color: '#94A3B8', font: { size: 11 }, filter: (item) => item.text === '평균' } },
                    tooltip: {
                        backgroundColor: 'rgba(10, 14, 26, 0.9)',
                        callbacks: {
                            title: (items) => Array.isArray(items[0].label) ? items[0].label.join('') : items[0].label,
                            label: (ctx) => {
                                if (ctx.datasetIndex === 1) return `평균: ${Math.round(ctx.parsed.y).toLocaleString()}만`;
                                const d = tempData[ctx.dataIndex];
                                return [`전략: ${d.strategy}`, `섹터: ${d.sector}`, `금액: ${ctx.parsed.y.toLocaleString()}만`, `비중: ${(ctx.parsed.y / totalInvestment * 100).toFixed(1)}%`];
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8' } },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: (c) => {
                                const name = tempData[c.index]?.name;
                                const trimmed = String(name || '').trim();
                                return (avgValue > 0 && (currentData._calculatedAmounts[trimmed] || 0) >= avgValue) ? '#EF4444' : '#94A3B8';
                            },
                            font: (c) => {
                                const name = tempData[c.index]?.name;
                                const trimmed = String(name || '').trim();
                                const isBold = avgValue > 0 && (currentData._calculatedAmounts[trimmed] || 0) >= avgValue;
                                return { size: 11, weight: isBold ? 'bold' : 'normal' };
                            },
                            autoSkip: false, maxRotation: 0, minRotation: 0
                        }
                    }
                }
            },
            plugins: [sectorGroupPlugin]
        });
    } else {
        const summaryStats = document.querySelector('.summary-stats');
        if (summaryStats) summaryStats.classList.add('hidden');

        const labelCol = data.columns[0];
        data.data.forEach(row => {
            const label = row[labelCol];
            const val = row[columnName];
            const numVal = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
            if (label && !isNaN(numVal)) {
                labels.push(label);
                values.push(numVal);
                backgroundColors.push('rgba(212, 175, 55, 0.5)');
                borderColors.push('rgba(212, 175, 55, 1)');
            }
        });

        // 다른 시트에서도 선택된 컬럼 기준 평균 계산
        const sum = values.reduce((a, b) => a + b, 0);
        const avgValue = values.length > 0 ? sum / values.length : 0;
        currentData._avgAmount = avgValue;
        currentData._calculatedAmounts = labels.reduce((acc, label, i) => {
            const nameKey = String(label || '').trim();
            if (nameKey) acc[nameKey] = values[i];
            return acc;
        }, {});

        if (portfolioChart) portfolioChart.destroy();
        portfolioChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{ label: labelName, data: values, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1, borderRadius: 4 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8' } },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: (c) => {
                                const label = labels[c.index];
                                const trimmed = String(label || '').trim();
                                return (avgValue > 0 && (currentData._calculatedAmounts[trimmed] || 0) >= avgValue) ? '#EF4444' : '#94A3B8';
                            },
                            font: (c) => {
                                const label = labels[c.index];
                                const trimmed = String(label || '').trim();
                                const isBold = avgValue > 0 && (currentData._calculatedAmounts[trimmed] || 0) >= avgValue;
                                return { size: 11, weight: isBold ? 'bold' : 'normal' };
                            },
                            autoSkip: false, maxRotation: 0, minRotation: 0
                        }
                    }
                }
            }
        });
    }
}

function toggleTable() {
    const panel = document.getElementById('table-panel');
    if (panel) panel.classList.toggle('minimized');
}

function renderTableRows(rows, cols, rowMap = null) {
    const tbody = document.getElementById('table-body');
    const stickyCols = getInvestigationStickyIndices(cols);
    
    // 실적 시트인 경우 요약 행 필터링
    let displayRows = rows;
    let displayMap = rowMap || rows.map((_, idx) => idx);
    
    if (currentData && currentData.current_sheet === '실적') {
        const yearCol = currentData.columns.find(c => c.includes('연도')) || currentData.columns[0];
        const filtered = [];
        const filteredMap = [];
        rows.forEach((r, idx) => {
            const yearStr = String(r[yearCol] || '').trim();
            const isSummary = yearStr.includes('계') || yearStr.includes('평균') || 
                              yearStr.includes('최근') || yearStr.includes('총합') || 
                              yearStr.includes('합계') || yearStr === '';
            if (!isSummary) {
                filtered.push(r);
                filteredMap.push(displayMap[idx]);
            }
        });
        displayRows = filtered;
        displayMap = filteredMap;
    }

    const map = displayMap;
    tbody.innerHTML = displayRows.map((r, index) => {
        const originalIndex = map[index];
        return `
        <tr class="investigation-row-item ${isExplorationSheet(currentData?.current_sheet) && originalIndex === selectedInvestigationRowIndex ? 'active' : ''}" data-original-index="${originalIndex}">
            ${cols.map((c, colIndex) => {
            const stickyIndex = stickyCols.indexOf(colIndex);
            const className = stickyIndex !== -1 ? `sticky-col-${stickyIndex + 1}` : '';
            // \n을 <br>로 변환하여 줄바꿈 표시
            const cellVal = r[c] !== undefined && r[c] !== null ? String(r[c]) : '';
            const displayVal = cellVal.replace(/\n/g, '<br>').replace(/~~(.*?)~~/g, '<del>$1</del>');
            const isExploration = currentData && isExplorationSheet(currentData.current_sheet);
            const editAttrs = isExploration ? `contenteditable="true" data-row-index="${originalIndex}" data-col-key="${c}"` : '';
            return `<td class="${className}" ${editAttrs}>${displayVal}</td>`;
        }).join('')}
        </tr>
    `;
    }).join('');

    currentDisplayRows = displayRows;
    currentDisplayMap = map;

    if (currentData && isExplorationSheet(currentData.current_sheet)) {
        investigationRowMap = map;
        investigationCurrentRows = rows;
        // 이벤트 위임: tbody에 한 번만 등록 (기존 리스너 제거 후 재등록)
        tbody.removeEventListener('click', _investigationClickDelegate);
        tbody.removeEventListener('blur', _investigationBlurDelegate, true);
        tbody.removeEventListener('keydown', _investigationKeydownDelegate, true);
        tbody.addEventListener('click', _investigationClickDelegate);
        tbody.addEventListener('blur', _investigationBlurDelegate, true);
        tbody.addEventListener('keydown', _investigationKeydownDelegate, true);
    } else if (currentData && currentData.current_sheet === '매매일지') {
        tbody.removeEventListener('click', _journalClickDelegate);
        tbody.addEventListener('click', _journalClickDelegate);
    }
}

// 이벤트 위임 핸들러 (탐구생활 시트)
function _investigationClickDelegate(e) {
    const row = e.target.closest('tr.investigation-row-item');
    if (row) {
        const originalIndex = parseInt(row.dataset.originalIndex, 10);
        setSelectedInvestigationRow(originalIndex);
    }
}

function _investigationBlurDelegate(e) {
    if (e.target.tagName === 'TD' && e.target.contentEditable === 'true') {
        handleInvestigationCellBlur.call(e.target, e);
    }
}

function _investigationKeydownDelegate(e) {
    if (e.target.tagName === 'TD' && e.target.contentEditable === 'true') {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            document.execCommand('insertLineBreak');
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.target.blur();
        }
    }
}

// 이벤트 위임 핸들러 (매매일지 시트)
function _journalClickDelegate(e) {
    const row = e.target.closest('tr');
    if (row && row.dataset.originalIndex !== undefined) {
        const originalIndex = parseInt(row.dataset.originalIndex, 10);
        if (typeof setJournalEditMode === 'function') {
            const rowData = currentDisplayRows.find((_, i) => currentDisplayMap[i] === originalIndex);
            if (rowData) {
                setJournalEditMode(originalIndex, rowData);
            }
        }
    }
}

function renderInvestigationPanel(data) {
    const panel = document.getElementById('investigation-panel');
    if (!panel) return;
    panel.classList.remove('hidden');

    // ── 빈 행(종목명 없고 모든 필드 빈 값) 필터링 ──
    const nameCol = findStockColumnName(data.columns);
    const cleanData = data.data.filter(row => {
        const name = String(row[nameCol] || '').replace(/~~/g, '').trim();
        if (name !== '') return true; // 종목명 있으면 유지
        // 종목명이 비어있어도 다른 필드에 내용이 있으면 유지
        for (const col of data.columns) {
            if (col === data.columns[0]) continue; // 번호 컬럼 제외
            if (col === nameCol) continue;
            const val = String(row[col] || '').trim();
            if (val !== '') return true;
        }
        return false; // 모든 필드가 비었으면 제외
    });
    data.data = cleanData;

    investigationRowMap = data.data.map((_, idx) => idx);
    investigationCurrentRows = data.data;

    // 모바일: 좌측 목록 보이도록 초기화
    if (window.innerWidth <= 768) {
        const leftPanel = document.querySelector('.investigation-left-panel');
        const rightPanel = document.querySelector('.investigation-right-panel');
        if (leftPanel) leftPanel.classList.remove('hidden-on-mobile');
        if (rightPanel) rightPanel.classList.remove('visible-on-mobile');
    }

    // 종목명 datalist 업데이트
    updateInvestigationStockList(data);
    // 좌측 카드 목록 렌더링 (빈 행 자동 필터링됨)
    renderInvestigationCards(data.data, data.columns);

    // 첫 번째 항목 선택 (편집 폼은 렌더링하되, 모바일에서는 목록 화면 유지)
    if (data.data.length > 0) {
        if (selectedInvestigationRowIndex === null || selectedInvestigationRowIndex >= data.data.length) {
            selectedInvestigationRowIndex = 0;
        }
        // 카드 하이라이트 + 편집 폼 렌더링 (모바일 전환은 하지 않음)
        document.querySelectorAll('#investigation-card-list .investigation-card').forEach(el => {
            el.classList.toggle('selected', parseInt(el.dataset.originalIndex, 10) === selectedInvestigationRowIndex);
        });
        renderInvestigationEditForm(selectedInvestigationRowIndex);
    }

    // ── 신호 계산용 현재가 배치 조회 (백그라운드) ──
    fetchInvestigationPrices().then(() => {
        // 가격 로드 완료 후 카드 다시 그려서 신호 뱃지 반영
        renderInvestigationCards(
            investigationCurrentRows || data.data,
            data.columns,
            investigationRowMap || data.data.map((_, idx) => idx)
        );
    });
}

function mapColumnLabel(columnName) {
    if (columnName === 'Unnamed: 0') return '번호';
    if (columnName === 'Unnamed: 1') return '종목명';
    if (columnName === 'Unnamed: 2') return '질문';
    if (columnName === '질문') return '질문';
    if (columnName === 'Unnamed: 3') return '모멘텀(시점)';
    if (columnName === '모멘텀') return '모멘텀(시점)';
    if (columnName === 'Unnamed: 4') return '매수 이유';
    if (columnName === 'Unnamed: 5') return '리스크';
    if (columnName === 'Unnamed: 6') return '대표 / 경영진';
    if (columnName === 'Unnamed: 7') return '매매 전략';
    if (columnName === 'Unnamed: 8') return '목표일';
    if (columnName === 'Unnamed: 9') return '목표가';
    if (columnName === 'Unnamed: 10') return '목표가';
    return columnName;
}

/**
 * 좌측 카드 목록 렌더링 (번호 + 종목명만 표시)
 */
function renderInvestigationCards(rows, cols, rowMap = null) {
    const container = document.getElementById('investigation-card-list');
    if (!container) return;

    // ── 빈 행 필터링 (종목명 없고 모든 필드가 빈 행은 표시 안 함) ──
    const nameCol = findStockColumnName(cols);
    const filteredRows = [];
    const filteredIndices = [];
    rows.forEach((row, idx) => {
        const name = String(row[nameCol] || '').replace(/~~/g, '').trim();
        if (name !== '') { filteredRows.push(row); filteredIndices.push(idx); return; }
        // 종목명이 비어도 다른 필드에 내용 있으면 표시
        for (const col of cols) {
            if (col === cols[0]) continue;
            if (col === nameCol) continue;
            const val = String(row[col] || '').trim();
            if (val !== '') { filteredRows.push(row); filteredIndices.push(idx); return; }
        }
        // 완전히 빈 행 → 제외
    });

    const map = rowMap 
        ? filteredIndices.map(i => rowMap[i]).filter(i => i !== undefined)
        : filteredRows.map((_, idx) => idx);
    investigationRowMap = map;
    investigationCurrentRows = filteredRows;

    // 종목명 및 모멘텀/목표 컬럼 찾기
    const numCol = cols[0];  // 번호
    const momentumCol = currentData.columns.includes('모멘텀') ? '모멘텀' : 'Unnamed: 2';
    // 목표가 컬럼 찾기 (명명된 컬럼 또는 Unnamed fallback)
    const tpCol = currentData.columns.find(c => String(c).includes('목표가') || c === 'Unnamed: 9' || c === 'Unnamed: 10') || null;
    const tdCol = currentData.columns.find(c => String(c).includes('목표일') || c === 'Unnamed: 8') || null;

    container.innerHTML = filteredRows.map((row, index) => {
        const originalIndex = map[index];
        const isActive = originalIndex === selectedInvestigationRowIndex;
        const numVal = row[numCol] !== undefined ? row[numCol] : '';
        const nameVal = row[nameCol] !== undefined ? row[nameCol] : '(이름 없음)';
        const displayTitle = String(nameVal).replace(/~~(.*?)~~/g, '<del>$1</del>');
        const isCancelled = String(nameVal).includes('~~');

        // 모멘텀 데이터 존재 여부 확인
        const hasMomentum = row[momentumCol] && String(row[momentumCol]).trim() !== '';
        // 목표가/목표일 존재 여부
        const targetPrice = tpCol ? String(row[tpCol] || '').trim() : '';
        const targetDate = tdCol ? String(row[tdCol] || '').trim() : '';
        const hasTarget = targetPrice !== '' || targetDate !== '';

        // ── 신호 상태 계산 ──
        const signal = computeSignalStatus(row, currentData.columns || cols);

        // 목표가 천단위 콤마 포맷
        let targetBadge = '';
        if (hasTarget) {
            const parts = [];
            if (targetDate) parts.push(`📅 ${targetDate}`);
            if (targetPrice) {
                const priceNum = parseInt(targetPrice.replace(/,/g, ''), 10);
                if (!isNaN(priceNum)) parts.push(`💰 ${priceNum.toLocaleString()}원`);
                else parts.push(`💰 ${targetPrice}`);
            }
            targetBadge = `<div class="investigation-target-badge">${parts.join(' ')}</div>`;
        }

        // ── 신호 뱃지 ──
        let signalBadge = '';
        if (signal.hasSignal) {
            let signalLabel = '🔔 신호';
            if (signal.signalType === 'date') signalLabel = '📅 목표일 도달';
            else if (signal.signalType === 'price') signalLabel = '💰 목표가 도달';
            else if (signal.signalType === 'both') signalLabel = '🔔 목표일+목표가 도달';
            signalBadge = `<div class="investigation-signal-badge">${signalLabel}</div>`;
        }

        return `
            <div class="investigation-card${isActive ? ' selected' : ''}${isCancelled ? ' cancelled' : ''}${signal.hasSignal ? ' has-signal' : ''}" data-original-index="${originalIndex}">
                <div class="investigation-card-header">
                    <div class="investigation-card-title ${hasMomentum ? 'has-momentum' : ''}">${displayTitle}</div>
                    <div class="investigation-card-subtitle">${numVal}</div>
                </div>
                ${signalBadge}
                ${targetBadge}
            </div>
        `;
    }).join('');

    container.querySelectorAll('.investigation-card').forEach(card => {
        const originalIndex = parseInt(card.dataset.originalIndex, 10);
        card.addEventListener('click', () => setSelectedInvestigationRow(originalIndex));
    });
}

/**
 * 우측 편집 폼: 선택된 종목의 컬럼별 textarea 렌더링
 */
function renderInvestigationEditForm(rowIndex) {
    if (!currentData) return;
    const row = currentData.data[rowIndex];
    const cols = currentData.columns;
    if (!row) return;

    const form = document.getElementById('investigation-edit-form');
    const titleEl = document.getElementById('inv-edit-title');
    // 우측 헤더: 종목명 표시
    const nameCol = findStockColumnName(cols);
    titleEl.innerHTML = String(row[nameCol] || '—').replace(/~~(.*?)~~/g, '<del>$1</del>');

    // 컬럼별 editable div 생성 (번호 컬럼은 읽기 전용 / 목표일은 date input)
    form.innerHTML = cols.map((col, idx) => {
        const label = mapColumnLabel(col);
        const rawValue = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
        // ~~텍스트~~를 <del>텍스트</del>로 변환하여 시각화
        const displayValue = rawValue.replace(/\n/g, '<br>').replace(/~~(.*?)~~/g, '<del>$1</del>');
        // 목표일 컬럼 판별 (명명된 컬럼 또는 Unnamed: 8)
        const isTargetDate = (
            String(col).includes('목표일') || col === 'Unnamed: 8'
        );
        // 한 줄 입력 필드: 번호, 종목명, 목표일, 목표가
        const isSingleLine = (
            idx === 0 || 
            col === nameCol || 
            isTargetDate ||
            String(col).includes('목표가') ||
            col === 'Unnamed: 9' ||
            col === 'Unnamed: 10'
        );

        // ── 목표일 컬럼: 달력(date input)으로 렌더링 ──
        if (isTargetDate) {
            // YYYY-MM-DD 형식만 추출 (텍스트에 다른 내용이 섞여 있을 수 있음)
            const dateMatch = rawValue.match(/(\d{4}-\d{2}-\d{2})/);
            const dateValue = dateMatch ? dateMatch[1] : '';
            return `
                <div class="inv-field-group">
                    <label class="inv-field-label">${label}</label>
                    <input type="date"
                           class="inv-field-date-input"
                           data-col-key="${col}"
                           data-row-index="${rowIndex}"
                           value="${dateValue}"
                           style="width:100%; height:42px; padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:#FFFFFF; font-size:15px; box-sizing:border-box;" />
                </div>
            `;
        }

        return `
            <div class="inv-field-group">
                <label class="inv-field-label">${label}</label>
                <div class="inv-field-editable ${isSingleLine ? 'single-line' : ''}"
                     contenteditable="${idx === 0 ? 'false' : 'true'}"
                     data-col-key="${col}"
                     data-row-index="${rowIndex}">${displayValue}</div>
            </div>
        `;
    }).join('');

    // ── date input 이벤트 등록 (change 시 자동 저장) ──
    form.querySelectorAll('.inv-field-date-input').forEach(input => {
        input.addEventListener('change', () => {
            const colKey = input.dataset.colKey;
            const rIdx = parseInt(input.dataset.rowIndex, 10);
            const newValue = input.value; // YYYY-MM-DD

            if (!currentData.data[rIdx]) return;
            if (String(currentData.data[rIdx][colKey] || '') === newValue) return;

            currentData.data[rIdx][colKey] = newValue;
            saveInvestigationRow(rIdx, currentData.data[rIdx]);
            showToast('목표일이 저장되었습니다.', 'success');
        });
    });

    // 각 editable div 이벤트 등록
    form.querySelectorAll('.inv-field-editable').forEach(ed => {
        // Shift+Enter: 줄바꿈 / Enter: 자동 저장
        ed.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && ed.classList.contains('single-line')) {
                e.preventDefault();
                ed.blur();
            } else if (e.key === 'Enter' && e.shiftKey && !ed.classList.contains('single-line')) {
                // Shift+Enter: 현재 위치에 오늘 날짜 삽입 후 줄바꿈
                e.preventDefault();
                const dateStr = formatAutoSaveDate(new Date());
                document.execCommand('insertText', false, ` ${dateStr}`);
                document.execCommand('insertLineBreak');
            }
        });

        // 포커스 아웃 → 자동 저장
        ed.addEventListener('blur', () => {
            const colKey = ed.dataset.colKey;
            const rIdx = parseInt(ed.dataset.rowIndex, 10);

            // HTML에서 텍스트와 취소선 정보 추출
            const newValue = getTextFromEditable(ed);

            if (!currentData.data[rIdx]) return;
            
            // 종목명 중복 체크
            const nameCol = findStockColumnName(currentData.columns);
            if (colKey === nameCol && newValue.trim() !== '') {
                const duplicateIndex = currentData.data.findIndex((row, idx) => {
                    if (idx === rIdx) return false;
                    const existingName = String(row[nameCol] || '').trim();
                    // 취소선(~~) 제거 후 비교하여 동일 종목인지 판단
                    const cleanExisting = existingName.replace(/~~/g, '');
                    const cleanNew = newValue.trim().replace(/~~/g, '');
                    return cleanExisting === cleanNew;
                });

                if (duplicateIndex !== -1) {
                    alert(`'${newValue.replace(/~~/g, '')}'은(는) 이미 탐구생활에 존재하는 종목명입니다.\n해당 종목으로 자동 이동합니다.`);
                    // 원래 값으로 복구
                    const originalValue = String(currentData.data[rIdx][colKey] || '');
                    ed.innerHTML = originalValue.replace(/\n/g, '<br>').replace(/~~(.*?)~~/g, '<del>$1</del>');
                    
                    // 기존 종목으로 즉시 점프
                    setSelectedInvestigationRow(duplicateIndex);
                    return;
                }
            }

            if (String(currentData.data[rIdx][colKey] || '') === newValue) return;

            currentData.data[rIdx][colKey] = newValue;

            // 종목명이 바뀌면 헤더 타이틀 업데이트
            if (colKey === nameCol) {
                document.getElementById('inv-edit-title').innerHTML = ed.innerHTML;
                // 좌측 카드도 업데이트
                const card = document.querySelector(`#investigation-card-list .investigation-card[data-original-index="${rIdx}"]`);
                if (card) {
                    card.querySelector('.investigation-card-title').innerHTML = ed.innerHTML;
                    card.classList.toggle('cancelled', newValue.includes('~~'));
                }

                // ★ 종목명이 비어있고 다른 필드도 모두 비어있으면 행 삭제
                if (newValue.trim() === '' && isRowEmpty(currentData.data[rIdx], currentData.columns)) {
                    deleteInvestigationRow(rIdx);
                    return;
                }
            }

            saveInvestigationRow(rIdx, currentData.data[rIdx]);
        });
    });
}

/**
 * 행이 실질적으로 비어있는지 확인 (번호 컬럼만 있고 나머지 모두 빈 값)
 */
function isRowEmpty(row, cols) {
    const nameCol = findStockColumnName(cols);
    for (const col of cols) {
        if (col === cols[0]) continue; // 번호 컬럼은 무시
        const val = String(row[col] || '').trim();
        if (val !== '') return false;
    }
    return true;
}

/**
 * 빈 행 삭제: 로컬 데이터에서 제거 + UI 갱신
 * (엑셀에는 빈 행이 남지만, renderInvestigationCards에서 자동 필터링됨)
 */
function deleteInvestigationRow(rowIndex) {
    if (!currentData) return;
    if (rowIndex < 0 || rowIndex >= currentData.data.length) return;

    // 로컬 데이터에서 제거
    currentData.data.splice(rowIndex, 1);

    // UI 갱신
    renderInvestigationCards(currentData.data, currentData.columns);
    if (currentData.data.length > 0) {
        setSelectedInvestigationRow(0);
    } else {
        document.getElementById('investigation-edit-form').innerHTML = `
            <div class="inv-edit-placeholder">
                <p>좌측에서 종목을 선택하세요</p>
            </div>
        `;
        document.getElementById('inv-edit-title').textContent = '—';
    }
    showToast('빈 종목이 삭제되었습니다.', 'info');
}

/**
 * 탐구생활 패널 로드 시 기존 빈 행 일괄 정리
 */
async function cleanupEmptyInvestigationRows() {
    if (!currentData || !isExplorationSheet(currentData.current_sheet)) return;
    
    const cols = currentData.columns;
    const toDelete = [];
    
    currentData.data.forEach((row, idx) => {
        if (isRowEmpty(row, cols)) {
            toDelete.push(idx);
        }
    });

    if (toDelete.length === 0) return;

    // 역순으로 삭제 (인덱스 변화 방지)
    for (let i = toDelete.length - 1; i >= 0; i--) {
        const idx = toDelete[i];
        const row = currentData.data[idx];
        // 서버에 빈 값으로 덮어쓰기
        try {
            const sheetName = currentData.current_sheet;
            const filePath = currentData._filePath;
            const emptyValues = currentData.columns.map(() => '');
            await fetch(`${API}/update-row`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file: filePath, sheet: sheetName, rowIndex: idx, values: emptyValues })
            });
        } catch (e) { /* 무시 */ }
        currentData.data.splice(idx, 1);
    }

    console.log(`[정리] 빈 행 ${toDelete.length}개 삭제 완료`);
}

/** HTML 특수문자 이스케이프 (textarea innerHTML 삽입 방지) */
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** 저장 버튼 클릭: 현재 폼의 모든 값 일괄 저장 */
function saveSelectedInvestigationRow() {
    if (selectedInvestigationRowIndex === null || !currentData) return;
    const rIdx = selectedInvestigationRowIndex;
    const form = document.getElementById('investigation-edit-form');
    form.querySelectorAll('.inv-field-editable').forEach(ed => {
        const colKey = ed.dataset.colKey;
        if (colKey) currentData.data[rIdx][colKey] = getTextFromEditable(ed);
    });
    saveInvestigationRow(rIdx, currentData.data[rIdx]);
    showToast('저장되었습니다.', 'success');
}

function updateInvestigationStockList(data) {
    const stockCol = findStockColumnName(data.columns);
    const datalist = document.getElementById('investigation-stock-list');
    if (!datalist) return;

    const stocks = new Set();
    data.data.forEach(row => {
        const stockName = row[stockCol];
        if (stockName && String(stockName).trim()) {
            stocks.add(String(stockName).trim());
        }
    });

    datalist.innerHTML = Array.from(stocks)
        .sort()
        .map(stock => `<option value="${stock}">`)
        .join('');

    // 선택 시 자동 서칭
    const searchInput = document.getElementById('investigation-stock-search');
    if (searchInput) {
        // 기존 리스너 제거 후 새로 추가 (중복 방지)
        const newInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newInput, searchInput);
        newInput.addEventListener('change', () => {
            if (newInput.value.trim()) {
                searchInvestigationStock();
            }
        });
    }
}

function isExplorationSheet(sheetName) {
    return String(sheetName || '').includes(EXPLORATION_SHEET_KEYWORD);
}

function findStockColumnName(columns) {
    return columns.find(c => String(c).includes('종목') || String(c).toLowerCase().includes('stock')) || columns[1] || columns[0];
}

function findDateColumnName(columns) {
    return columns.find(c => String(c).includes('날짜') || String(c).toLowerCase().includes('date')) || columns[0];
}

function formatAutoSaveDate(date) {
    return `(${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()})`;
}

function setSelectedInvestigationRow(rowIndex) {
    if (!currentData || !isExplorationSheet(currentData.current_sheet)) return;
    selectedInvestigationRowIndex = rowIndex;

    // 좌측 카드 선택 표시 업데이트
    document.querySelectorAll('#investigation-card-list .investigation-card').forEach(el => {
        el.classList.toggle('selected', parseInt(el.dataset.originalIndex, 10) === rowIndex);
    });

    // 선택된 카드가 화면에 보이도록 스크롤
    const selectedCard = document.querySelector(
        `#investigation-card-list .investigation-card[data-original-index="${rowIndex}"]`
    );
    if (selectedCard) selectedCard.scrollIntoView({ block: 'nearest' });

    // 우측 편집 폼 렌더링
    renderInvestigationEditForm(rowIndex);

    // 모바일: 편집 화면으로 전환
    switchToMobileEditView();
}

/**
 * 모바일 화면(≤768px)에서 우측 편집 폼을 전체 화면으로 전환
 */
function switchToMobileEditView() {
    if (window.innerWidth > 768) return;
    const leftPanel = document.querySelector('.investigation-left-panel');
    const rightPanel = document.querySelector('.investigation-right-panel');
    if (leftPanel) leftPanel.classList.add('hidden-on-mobile');
    if (rightPanel) rightPanel.classList.add('visible-on-mobile');
}

/**
 * 모바일 화면에서 좌측 종목 목록으로 돌아가기
 */
function goBackToInvestigationList() {
    const leftPanel = document.querySelector('.investigation-left-panel');
    const rightPanel = document.querySelector('.investigation-right-panel');
    if (leftPanel) leftPanel.classList.remove('hidden-on-mobile');
    if (rightPanel) rightPanel.classList.remove('visible-on-mobile');
}

async function searchInvestigationStock() {
    if (!currentData || !isExplorationSheet(currentData.current_sheet)) return;
    const q = document.getElementById('investigation-stock-search').value.trim().toLowerCase();
    const stockCol = findStockColumnName(currentData.columns);
    if (!q) {
        resetInvestigationSearch();
        return;
    }
    const filtered = [];
    const rowMap = [];
    currentData.data.forEach((row, idx) => {
        const stock = String(row[stockCol] || '').toLowerCase();
        if (stock.includes(q)) {
            filtered.push(row);
            rowMap.push(idx);
        }
    });
    if (filtered.length === 0) {
        showToast('검색 결과가 없습니다.', 'info');
    }
    renderInvestigationCards(filtered, currentData.columns, rowMap);
    if (rowMap.length > 0) {
        setSelectedInvestigationRow(rowMap[0]);
    }
}

function resetInvestigationSearch() {
    if (!currentData || !isExplorationSheet(currentData.current_sheet)) return;
    document.getElementById('investigation-stock-search').value = '';
    renderInvestigationCards(currentData.data, currentData.columns);
    // 모바일: 목록 화면으로 돌아가기 (편집 화면이 아닌)
    if (window.innerWidth <= 768) {
        goBackToInvestigationList();
        // 카드 하이라이트만 업데이트 (편집 폼은 렌더링하지 않음)
        document.querySelectorAll('#investigation-card-list .investigation-card').forEach(el => {
            el.classList.toggle('selected', parseInt(el.dataset.originalIndex, 10) === 0);
        });
        selectedInvestigationRowIndex = 0;
        renderInvestigationEditForm(0); // 편집 폼 내용은 업데이트 (백그라운드)
    } else {
        setSelectedInvestigationRow(0);
    }
}

/**
 * 매매 우선: 모멘텀(시점) 데이터가 있는 종목만 필터링하여 표시
 */
function filterMomentumStocks() {
    if (!currentData || !isExplorationSheet(currentData.current_sheet)) return;

    const momentumCol = currentData.columns.includes('모멘텀') ? '모멘텀' : 'Unnamed: 2';
    const strategyCol = currentData.columns.includes('매매 전략') ? '매매 전략' : 'Unnamed: 6'; // 매매 전략 컬럼 추가
    const filtered = [];
    const rowMap = [];

    currentData.data.forEach((row, idx) => {
        const momentum = String(row[momentumCol] || '').trim();
        const strategy = String(row[strategyCol] || '').trim(); // 매매 전략 값 가져오기
        
        // 모멘텀 또는 매매 전략 둘 중 하나라도 내용이 있는 경우 매매우선으로 선택
        if (momentum !== '' || strategy !== '') {
            filtered.push(row);
            rowMap.push(idx);
        }
    });

    if (filtered.length === 0) {
        showToast('매매 우선 데이터(모멘텀 또는 매매 전략)가 있는 종목이 없습니다.', 'info');
        return;
    }

    renderInvestigationCards(filtered, currentData.columns, rowMap);
    if (rowMap.length > 0) {
        setSelectedInvestigationRow(rowMap[0]);
    }
    showToast(`${filtered.length}개의 매매 우선 종목을 찾았습니다.`, 'success');
}

// ── 신호 계산: 목표일 경과 / 목표가 도달 여부 ──
window._investigationPrices = window._investigationPrices || {};

/**
 * 종목별 신호 상태 계산
 * - 목표일 신호: 오늘 >= 목표일
 * - 목표가 신호: 현재가 >= 목표가 (window._investigationPrices 캐시 사용)
 * 반환: { hasSignal, signalType: 'date'|'price'|'both'|null }
 */
function computeSignalStatus(row, cols) {
    const todayStr = new Date().toISOString().split('T')[0];

    const tdCol = cols.find(c => String(c).includes('목표일') || c === 'Unnamed: 8');
    const tpCol = cols.find(c => String(c).includes('목표가') || c === 'Unnamed: 9' || c === 'Unnamed: 10');

    const targetDate = tdCol ? String(row[tdCol] || '').trim() : '';
    const targetPriceRaw = tpCol ? String(row[tpCol] || '').trim() : '';
    const targetPrice = parseInt(targetPriceRaw.replace(/[^0-9]/g, ''), 10) || 0;

    let dateSignal = false;
    let priceSignal = false;

    // 목표일 신호: YYYY-MM-DD 형식 추출 후 오늘과 비교
    const dateMatch = targetDate.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch && dateMatch[1] <= todayStr) {
        dateSignal = true;
    }

    // 목표가 신호: 현재가 캐시가 있고 목표가 이상이면 신호
    if (targetPrice > 0) {
        const nameCol = findStockColumnName(cols);
        const stockName = String(row[nameCol] || '').replace(/~~/g, '').trim();
        const currentPrice = window._investigationPrices[stockName];
        if (currentPrice && currentPrice > 0 && currentPrice >= targetPrice) {
            priceSignal = true;
        }
    }

    if (dateSignal && priceSignal) return { hasSignal: true, signalType: 'both', targetDate, targetPrice };
    if (dateSignal) return { hasSignal: true, signalType: 'date', targetDate, targetPrice };
    if (priceSignal) return { hasSignal: true, signalType: 'price', targetDate, targetPrice };
    return { hasSignal: false, signalType: null, targetDate, targetPrice };
}

/**
 * 탐구생활 종목들의 현재가를 서버에서 배치로 가져와 캐시
 */
async function fetchInvestigationPrices() {
    if (!currentData || !isExplorationSheet(currentData.current_sheet)) return;

    const nameCol = findStockColumnName(currentData.columns);
    const stockNames = currentData.data
        .map(row => String(row[nameCol] || '').replace(/~~/g, '').trim())
        .filter(name => name && name !== '');

    // 중복 제거
    const uniqueNames = [...new Set(stockNames)];
    if (uniqueNames.length === 0) return;

    try {
        const res = await fetch(`${API}/batch-current-prices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names: uniqueNames })
        });
        const data = await res.json();
        if (data.success && data.prices) {
            window._investigationPrices = { ...window._investigationPrices, ...data.prices };
            // localStorage에도 저장 (다음 방문 시 빠른 로드)
            try {
                localStorage.setItem('investigationPrices', JSON.stringify({
                    date: new Date().toISOString().split('T')[0],
                    prices: window._investigationPrices
                }));
            } catch (e) {}
        }
    } catch (e) {
        console.warn('investigation prices fetch failed:', e);
        // fallback: localStorage 캐시 사용
        try {
            const cached = localStorage.getItem('investigationPrices');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.prices) {
                    window._investigationPrices = { ...window._investigationPrices, ...parsed.prices };
                }
            }
        } catch (e2) {}
    }
}

function filterTargetStocks() {
    // 이전 버전 호환성 유지 → filterSignalStocks 로 리다이렉트
    filterSignalStocks();
}

/**
 * 신호 필터: 목표일 경과 또는 목표가 도달된 종목만 표시
 */
function filterSignalStocks() {
    if (!currentData || !isExplorationSheet(currentData.current_sheet)) return;

    const cols = currentData.columns;
    
    // 목표일/목표가 컬럼 존재 여부 확인
    const tdCol = cols.find(c => String(c).includes('목표일') || c === 'Unnamed: 8');
    const tpCol = cols.find(c => String(c).includes('목표가') || c === 'Unnamed: 9' || c === 'Unnamed: 10');
    
    if (!tdCol && !tpCol) {
        showToast('목표일/목표가 컬럼이 없습니다. 먼저 엑셀에 컬럼을 추가해주세요.', 'error');
        return;
    }

    // 목표일/목표가가 하나라도 입력된 종목 수 확인
    let totalWithTarget = 0;
    currentData.data.forEach(row => {
        const td = tdCol ? String(row[tdCol] || '').trim() : '';
        const tp = tpCol ? String(row[tpCol] || '').trim() : '';
        if (td !== '' || tp !== '') totalWithTarget++;
    });

    if (totalWithTarget === 0) {
        // 목표 데이터 자체가 하나도 없음 → 카드 비우고 안내
        renderInvestigationCards([], currentData.columns, []);
        document.getElementById('investigation-edit-form').innerHTML = `
            <div class="inv-edit-placeholder">
                <p>📋 아직 목표일/목표가를 입력한 종목이 없습니다.</p>
                <p style="font-size:12px; color:#64748B;">종목을 선택하고 우측 편집 폼에서 목표일(YYYY-MM-DD)과 목표가(숫자)를 입력해주세요.</p>
            </div>
        `;
        showToast('목표일/목표가가 입력된 종목이 하나도 없습니다. 먼저 목표 데이터를 입력해주세요.', 'info');
        return;
    }

    const filtered = [];
    const rowMap = [];
    let dateSignals = 0;
    let priceSignals = 0;

    currentData.data.forEach((row, idx) => {
        const signal = computeSignalStatus(row, cols);
        if (signal.hasSignal) {
            filtered.push(row);
            rowMap.push(idx);
            if (signal.signalType === 'date' || signal.signalType === 'both') dateSignals++;
            if (signal.signalType === 'price' || signal.signalType === 'both') priceSignals++;
        }
    });

    if (filtered.length === 0) {
        // 신호 0건 → 카드 비우고 안내
        renderInvestigationCards([], currentData.columns, []);
        document.getElementById('investigation-edit-form').innerHTML = `
            <div class="inv-edit-placeholder">
                <p>🔔 아직 신호가 발생한 종목이 없습니다.</p>
                <p style="font-size:12px; color:#64748B;">
                    📅 목표일 신호: 오늘(${new Date().toISOString().split('T')[0]}) 기준으로 목표일이 지난 종목<br/>
                    💰 목표가 신호: 현재 주가가 목표가 이상인 종목
                </p>
                <p style="font-size:11px; color:#475569; margin-top:8px;">
                    (목표 데이터 입력된 종목: ${totalWithTarget}건 / 신호: 0건)
                </p>
            </div>
        `;
        showToast(`목표 데이터 ${totalWithTarget}건 중 신호 발생 종목이 없습니다.`, 'info');
        return;
    }

    renderInvestigationCards(filtered, currentData.columns, rowMap);
    if (rowMap.length > 0) {
        setSelectedInvestigationRow(rowMap[0]);
    }

    let detailMsg = '';
    if (dateSignals > 0) detailMsg += `📅 목표일 경과: ${dateSignals}건 `;
    if (priceSignals > 0) detailMsg += `💰 목표가 도달: ${priceSignals}건`;
    showToast(`🔔 신호 발생 종목 ${filtered.length}개 발견! ${detailMsg}`, 'success');
}

/**
 * 탐구생활 신규 종목 추가 준비
 * 마지막 번호를 자동으로 계산하여 입력창을 초기화하고 새 행을 생성합니다.
 */
function prepareNewInvestigationRow() {
    if (!currentData || !isExplorationSheet(currentData.current_sheet)) return;

    // 1. 마지막 번호 찾기 (컬럼 0 기준)
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
    if (numCol !== 'Unnamed: 0') newRow['Unnamed: 0'] = nextNum; // 번호 설정

    // 날짜 컬럼이 있으면 오늘 날짜로 초기화 (번호 컬럼과 겹치지 않을 때만)
    const dateCol = findDateColumnName(currentData.columns);
    if (dateCol && dateCol !== currentData.columns[0]) {
        newRow[dateCol] = formatAutoSaveDate(new Date());
    }

    // 3. 데이터 추가 및 UI 갱신
    const newIndex = currentData.data.length;
    currentData.data.push(newRow);

    // 검색창 초기화 (전체 목록 보기)
    document.getElementById('investigation-stock-search').value = '';
    renderInvestigationCards(currentData.data, currentData.columns);

    // 새로 추가된 행 선택
    setSelectedInvestigationRow(newIndex);

    // 4. 서버에 즉시 저장 (새 행 생성 반영)
    saveInvestigationRow(newIndex, newRow);

    showToast(`새 종목(번호: ${nextNum})이 추가되었습니다. 내용을 입력해주세요.`, 'success');
}

/**
 * contenteditable innerHTML에서 실제 텍스트 값(줄바꿈 포함)을 추출
 * <br>, <div> 태그를 \n으로 변환
 */
function getTextFromEditable(td) {
    // 임시 div에 innerHTML을 복사하여 변환 처리
    const clone = td.cloneNode(true);
    // <br> → 줄바꿈 마커로 교체
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    // <div>, <p> 등 블록 요소 → 앞에 줄바꿈 추가
    clone.querySelectorAll('div, p').forEach(block => {
        block.prepend('\n');
        block.replaceWith(...block.childNodes);
    });
    // <del>, <s>, <strike> 태그를 ~~텍스트~~ 형식으로 변환 (취소선 정보 유지)
    clone.querySelectorAll('del, s, strike').forEach(el => {
        const text = el.textContent;
        el.replaceWith(`~~${text}~~`);
    });
    // line-through 스타일이 적용된 span 등 처리
    clone.querySelectorAll('*').forEach(el => {
        if (el.style && el.style.textDecoration && el.style.textDecoration.includes('line-through')) {
            const text = el.textContent;
            el.replaceWith(`~~${text}~~`);
        }
    });
    // 최종 텍스트 추출 후 앞뒤 공백 제거, 연속 줄바꿈 3개 이상은 2개로 압축
    return clone.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

async function handleInvestigationCellBlur(event) {
    const td = event.target;
    const rowIndex = parseInt(td.dataset.rowIndex, 10);
    const colKey = td.dataset.colKey;
    if (Number.isNaN(rowIndex) || !colKey) return;

    // innerHTML 기반으로 줄바꿈 포함하여 값 추출
    const newValue = getTextFromEditable(td);
    const row = currentData.data[rowIndex];
    if (!row) return;

    // 종목명 중복 체크
    const nameCol = findStockColumnName(currentData.columns);
    if (colKey === nameCol && newValue.trim() !== '') {
        const duplicateIndex = currentData.data.findIndex((r, idx) => {
            if (idx === rowIndex) return false;
            const existingName = String(r[nameCol] || '').trim();
            const cleanExisting = existingName.replace(/~~/g, '');
            const cleanNew = newValue.trim().replace(/~~/g, '');
            return cleanExisting === cleanNew;
        });

        if (duplicateIndex !== -1) {
            alert(`'${newValue.replace(/~~/g, '')}'은(는) 이미 탐구생활에 존재하는 종목명입니다.\n해당 종목으로 자동 이동합니다.`);
            // 원래 값으로 복구
            td.innerHTML = String(row[colKey] || '').replace(/\n/g, '<br>').replace(/~~(.*?)~~/g, '<del>$1</del>');
            
            // 기존 종목으로 즉시 점프
            setSelectedInvestigationRow(duplicateIndex);
            return;
        }
    }

    // 값이 변경되지 않았으면 저장 생략
    if (String(row[colKey] || '') === newValue) return;

    row[colKey] = newValue;
    const dateCol = findDateColumnName(currentData.columns);
    if (colKey !== dateCol) {
        row[dateCol] = formatAutoSaveDate(new Date());
        const dateTd = td.parentElement.querySelector(`td:nth-child(${currentData.columns.indexOf(dateCol) + 1})`);
        if (dateTd) dateTd.textContent = row[dateCol];
        if (selectedInvestigationRowIndex === rowIndex) {
            document.getElementById('investigation-date-line').textContent = row[dateCol];
            document.getElementById('investigation-date-edit').value = row[dateCol];
        }
    }
    saveInvestigationRow(rowIndex, row);
}

async function saveInvestigationRow(rowIndex, rowData) {
    const sheetName = currentData.current_sheet;
    const filePath = currentData._filePath;
    const values = currentData.columns.map(col => rowData[col] !== undefined && rowData[col] !== null ? rowData[col] : '');
    try {
        const res = await fetch(`${API}/update-row`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: filePath, sheet: sheetName, rowIndex, values })
        });
        const payload = await res.json();
        if (!res.ok || !payload.success) {
            showToast(`저장 실패: ${payload.error || '알 수 없는 오류'}`, 'error');
        } else {
            showToast('수정 내용이 저장되었습니다.', 'success');
        }
    } catch (e) {
        console.error('Update row error:', e);
        showToast('편집 저장 중 오류가 발생했습니다.', 'error');
    }
}


function refreshData(isAuto = false) {
    if (currentData) {
        if (!isAuto) showToast('데이터를 새로고침합니다...', 'info');
        loadExcel(currentData._filePath, currentData.current_sheet);
    } else {
        init();
    }
}

function toggleAutoRefresh(enabled) {
    if (enabled) {
        showToast('자동 업데이트 활성화 (30초)', 'info');
        // 재귀적 setTimeout: 이전 요청 완료 후 다음 요청 스케줄링
        async function scheduleNext() {
            if (!autoRefreshEnabled) return;
            await refreshData(true);
            if (autoRefreshEnabled) {
                autoRefreshTimer = setTimeout(scheduleNext, REFRESH_INTERVAL);
            }
        }
        autoRefreshEnabled = true;
        autoRefreshTimer = setTimeout(scheduleNext, REFRESH_INTERVAL);
    } else {
        autoRefreshEnabled = false;
        if (autoRefreshTimer) {
            clearTimeout(autoRefreshTimer);
            autoRefreshTimer = null;
            showToast('자동 업데이트 비활성화', 'info');
        }
    }
}

function showToast(msg, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * 취소선 토글 기능
 * 현재 포커스된 contenteditable 요소에서 선택된 텍스트에 취소선을 적용/해제
 */
function toggleStrikethrough() {
    // 탐구생활 탭에서만 작동하도록 확인
    if (!isExplorationSheet(currentData?.current_sheet)) {
        return;
    }

    const activeEl = document.activeElement;
    const isEditable = activeEl && (activeEl.contentEditable === 'true' || activeEl.classList.contains('inv-field-editable'));

    if (isEditable) {
        // contenteditable인 경우
        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) {
            showToast('취소선으로 만들 텍스트를 선택하세요.', 'info');
            return;
        }

        // 브라우저 내장 명령을 사용하여 취소선을 토글합니다.
        // 이는 <del>, <s>, <strike> 및 복잡한 선택 영역을 가장 안전하게 처리합니다.
        document.execCommand('strikeThrough', false, null);
        
        showToast('취소선 상태가 변경되었습니다.', 'success');

        selection.removeAllRanges();
        activeEl.dispatchEvent(new Event('blur', { bubbles: true }));
        return;
    }

    showToast('편집 가능한 텍스트 영역을 먼저 선택하세요.', 'info');
}

// ===== 포트폴리오 맵 연동 유틸리티 =====

function updatePortfolioMapCache(data) {
    if (data.current_sheet !== '포트폴리오 맵') return;

    portfolioMapCache = {};
    if (!data.data || data.data.length === 0) return;

    // '종목' 이라는 텍스트가 포함된 컬럼 찾기
    let stockCol = null;
    const firstRow = data.data[0];
    for (const key in firstRow) {
        if (String(firstRow[key]).includes('종목')) {
            stockCol = key;
            break;
        }
    }
    // 못 찾으면 기본값 시도
    if (!stockCol) stockCol = 'Unnamed: 3';

    // 금액이 시작되는 컬럼('1'들이 적힌 곳) 찾기 (보통 Unnamed: 4 이후)
    const amountKeys = Object.keys(firstRow).filter(k => {
        const kNum = parseInt(k.replace('Unnamed: ', ''));
        return !isNaN(kNum) && kNum >= 4;
    });

    data.data.forEach(row => {
        const stockName = String(row[stockCol] || '').trim();
        // 종목명이 유효하고 헤더가 아닌 경우만 처리
        if (stockName && stockName !== '종목' && stockName !== 'stock') {
            let countOfOnes = 0;
            amountKeys.forEach(key => {
                const val = parseFloat(row[key]);
                if (val === 1) countOfOnes++;
            });
            if (countOfOnes > 0) {
                // 동일 종목이 여러 번 나오면 합산하는 대신 마지막 값으로 갱신 (엑셀 구조상 한 행이 원칙)
                portfolioMapCache[stockName] = countOfOnes * 100;
            }
        }
    });
}

async function fetchPortfolioMapData() {
    try {
        const timestamp = new Date().getTime();
        const url = `${API}/read-excel?file=${encodeURIComponent(TARGET_FILE)}&sheet=${encodeURIComponent('포트폴리오 맵')}&t=${timestamp}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.error) {
            updatePortfolioMapCache(data);
        }
    } catch (e) {
        console.error('Failed to fetch portfolio map for cache:', e);
    }
}

// ===== 현금 관리 유틸리티 =====

/**
 * 현금 패널 열기/닫기 토글
 */
function toggleCashPanel() {
    const body = document.getElementById('cash-panel-body');
    const chevron = document.getElementById('cash-panel-chevron');
    if (body.style.display === 'none') {
        body.style.display = 'block';
        chevron.textContent = '▲ 접기';
        renderCashAccounts();
        updateCashTrendChart();
        renderSnapshotTable();
    } else {
        body.style.display = 'none';
        chevron.textContent = '▼ 펼치기';
    }
}

/**
 * 현금 합계 반환 (백만 단위)
 */
function getTotalCash() {
    return cashAccounts.reduce((sum, acc) => sum + (parseFloat(acc.amount) || 0), 0);
}

/**
 * 현금 계좌 목록 렌더링
 */
function renderCashAccounts() {
    const container = document.getElementById('cash-accounts-list');
    if (!container) return;

    container.innerHTML = '';
    cashAccounts.forEach((acc, idx) => {
        const row = document.createElement('div');
        row.className = 'cash-account-row';
        row.innerHTML = `
            <input type="text" value="${acc.name || ''}" placeholder="계좌명 (예: 증권사A)" 
                   onchange="updateCashAccount(${idx}, 'name', this.value)" />
            <input type="number" value="${acc.amount || ''}" placeholder="0" step="1" min="0"
                   onchange="updateCashAccount(${idx}, 'amount', this.value)"
                   oninput="updateCashAccount(${idx}, 'amount', this.value)" />
            <span class="cash-unit-label">백만</span>
            <button class="cash-remove-btn" onclick="removeCashAccount(${idx})" title="삭제">
                ✕
            </button>
        `;
        container.appendChild(row);
    });

    updateInvestSummaryDisplay();
}

/**
 * 새 현금 계좌 추가
 */
function addCashAccount() {
    cashAccounts.push({ name: '', amount: 0 });
    saveCashAccounts();
    renderCashAccounts();
}

/**
 * 현금 계좌 값 업데이트 (계좌명 또는 금액)
 */
function updateCashAccount(index, field, value) {
    if (index < 0 || index >= cashAccounts.length) return;
    if (field === 'amount') {
        cashAccounts[index].amount = parseFloat(value) || 0;
    } else {
        cashAccounts[index][field] = value;
    }
    saveCashAccounts();
    updateCashSummary();
}

/**
 * 특정 현금 계좌 삭제
 */
function removeCashAccount(index) {
    if (index < 0 || index >= cashAccounts.length) return;
    cashAccounts.splice(index, 1);
    saveCashAccounts();
    renderCashAccounts();
    updateCashSummary();
}

/**
 * localStorage에 현금 데이터 저장
 */
function saveCashAccounts() {
    try {
        localStorage.setItem('cashAccounts', JSON.stringify(cashAccounts));
    } catch (e) {
        console.warn('현금 계좌 저장 실패:', e);
    }
}

// ===== 투자금 계좌 관리 함수 =====

/**
 * 투자금 계좌 합계 반환 (백만 단위)
 */
function getTotalInvestAccounts() {
    return investAccounts.reduce((sum, acc) => sum + (parseFloat(acc.amount) || 0), 0);
}

/**
 * 유효 투자금 반환 (백만 단위)
 * - 투자금 계좌가 입력되어 있으면 그 합계를 사용
 * - 미입력이면 포트폴리오 맵의 투자금(stat-total)을 사용
 */
function getEffectiveInvestment() {
    const investTotal = getTotalInvestAccounts();
    if (investTotal > 0) return investTotal;
    const statTotal = document.getElementById('stat-total');
    return statTotal ? parseFloat(statTotal.textContent.replace(/,/g, '')) || 0 : 0;
}

/**
 * 투자금 계좌 목록 렌더링
 */
function renderInvestAccounts() {
    const container = document.getElementById('invest-accounts-list');
    if (!container) return;

    container.innerHTML = '';
    investAccounts.forEach((acc, idx) => {
        const row = document.createElement('div');
        row.className = 'invest-account-row';
        row.innerHTML = `
            <input type="text" value="${acc.name || ''}" placeholder="계좌명 (예: 증권사A)" 
                   onchange="updateInvestAccount(${idx}, 'name', this.value)" />
            <input type="number" value="${acc.amount || ''}" placeholder="0" step="1" min="0"
                   onchange="updateInvestAccount(${idx}, 'amount', this.value)"
                   oninput="updateInvestAccount(${idx}, 'amount', this.value)" />
            <span class="cash-unit-label">백만</span>
            <button class="cash-remove-btn" onclick="removeInvestAccount(${idx})" title="삭제">
                ✕
            </button>
        `;
        container.appendChild(row);
    });

    updateInvestSummaryDisplay();
}

/**
 * 새 투자금 계좌 추가
 */
function addInvestAccount() {
    investAccounts.push({ name: '', amount: 0 });
    saveInvestAccounts();
    renderInvestAccounts();
}

/**
 * 투자금 계좌 값 업데이트 (계좌명 또는 금액)
 */
function updateInvestAccount(index, field, value) {
    if (index < 0 || index >= investAccounts.length) return;
    if (field === 'amount') {
        investAccounts[index].amount = parseFloat(value) || 0;
    } else {
        investAccounts[index][field] = value;
    }
    saveInvestAccounts();
    updateInvestSummaryDisplay();
    updateCashSummary();
}

/**
 * 특정 투자금 계좌 삭제
 */
function removeInvestAccount(index) {
    if (index < 0 || index >= investAccounts.length) return;
    investAccounts.splice(index, 1);
    saveInvestAccounts();
    renderInvestAccounts();
    updateCashSummary();
}

/**
 * localStorage에 투자금 데이터 저장
 */
function saveInvestAccounts() {
    try {
        localStorage.setItem('investAccounts', JSON.stringify(investAccounts));
    } catch (e) {
        console.warn('투자금 계좌 저장 실패:', e);
    }
}

/**
 * 투자금 합계 및 현금 합계 표시 업데이트
 */
function updateInvestSummaryDisplay() {
    // 현금 합계 표시
    const cashTotalDisplay = document.getElementById('cash-total-display');
    if (cashTotalDisplay) cashTotalDisplay.textContent = getTotalCash().toLocaleString();

    // 투자금 합계 표시
    const investTotalDisplay = document.getElementById('invest-total-display');
    const investSourceLabel = document.getElementById('invest-source-label');
    const investAccountTotal = getTotalInvestAccounts();

    if (investTotalDisplay) {
        if (investAccountTotal > 0) {
            investTotalDisplay.textContent = investAccountTotal.toLocaleString();
            if (investSourceLabel) investSourceLabel.textContent = '(계좌 입력 기준)';
        } else {
            const statTotal = document.getElementById('stat-total');
            const mapTotal = statTotal ? parseFloat(statTotal.textContent.replace(/,/g, '')) || 0 : 0;
            investTotalDisplay.textContent = mapTotal.toLocaleString();
            if (investSourceLabel) investSourceLabel.textContent = '(포트폴리오 맵 기준)';
        }
    }
}

/**
 * Summary 바의 현금/전체자산 영역만 즉시 업데이트
 */
function updateCashSummary() {
    const totalCash = getTotalCash();
    const effectiveInvestment = getEffectiveInvestment();
    const totalAsset = effectiveInvestment + totalCash;

    const statCash = document.getElementById('stat-cash');
    const statCashRatio = document.getElementById('stat-cash-ratio');
    const statTotalAsset = document.getElementById('stat-total-asset');

    if (statCash) statCash.textContent = totalCash.toLocaleString();
    if (statTotalAsset) statTotalAsset.textContent = totalAsset.toLocaleString();
    if (statCashRatio) {
        statCashRatio.textContent = totalAsset > 0
            ? `(${(totalCash / totalAsset * 100).toFixed(1)}%)`
            : '(0%)';
    }

    updateInvestSummaryDisplay();
    // 트렌드 차트 및 스냅샷 업데이트
    updateCashTrendChart();
}

/**
 * 월별 현금 & 투자금 스냅샷 저장 (현재 달 기준)
 */
function saveCurrentMonthSnapshot() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const currentMonthKey = `${year}-${month}`;

    const investment = getEffectiveInvestment();
    const cash = getTotalCash();
    const totalAsset = investment + cash;
    const ratio = totalAsset > 0 ? parseFloat((cash / totalAsset * 100).toFixed(1)) : 0;

    // 기존 기록 탐색
    const existingIdx = monthlyCashSnapshots.findIndex(item => item.month === currentMonthKey);
    const newSnapshot = {
        month: currentMonthKey,
        investment: investment,
        cash: cash,
        totalAsset: totalAsset,
        ratio: ratio
    };

    if (existingIdx !== -1) {
        monthlyCashSnapshots[existingIdx] = newSnapshot;
    } else {
        monthlyCashSnapshots.push(newSnapshot);
    }

    // 월 오름차순 정렬
    monthlyCashSnapshots.sort((a, b) => a.month.localeCompare(b.month));

    saveSnapshotsToStorage();
    updateCashTrendChart();
    renderSnapshotTable();

    alert(`[${currentMonthKey}] 스냅샷이 저장되었습니다.\n• 주식 투자금: ${investment.toLocaleString()}백만\n• 보유 현금: ${cash.toLocaleString()}백만\n• 현금 비중: ${ratio}%`);
}

/**
 * 월별 스냅샷 localStorage 저장
 */
function saveSnapshotsToStorage() {
    try {
        localStorage.setItem('monthlyCashSnapshots', JSON.stringify(monthlyCashSnapshots));
        
        // Flask 서버에도 저장 (모바일과 데이터 공유)
        const pcIp = localStorage.getItem('pc_ip') || '192.168.0.2';
        fetch(`http://${pcIp}:5000/api/cash-snapshots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(monthlyCashSnapshots)
        }).catch(() => {}); // 실패해도 무시 (오프라인 등)
    } catch (e) {
        console.warn('월별 현금 스냅샷 저장 실패:', e);
    }
}

/**
 * 월별 현금 비중 트렌드 Chart.js 그려주기
 */
function updateCashTrendChart() {
    const canvas = document.getElementById('cash-trend-chart');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
        console.warn('Chart.js가 아직 로드되지 않았습니다.');
        return;
    }

    // 기존 차트 파괴
    if (cashTrendChart) {
        cashTrendChart.destroy();
        cashTrendChart = null;
    }

    if (!monthlyCashSnapshots || monthlyCashSnapshots.length === 0) {
        // 데이터가 없으면 빈 안내 차트 표시
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'center';
        ctx.fillText('저장된 월별 현금 비중 데이터가 없습니다. [📸 이번 달 스냅샷 저장]을 눌러보세요.', canvas.width / 2, canvas.height / 2);
        return;
    }

    // 데이터 정렬 (월 오름차순)
    const sortedData = [...monthlyCashSnapshots].sort((a, b) => a.month.localeCompare(b.month));

    const labels = sortedData.map(d => d.month);
    const ratioData = sortedData.map(d => d.ratio);
    const cashData = sortedData.map(d => d.cash);

    // 각 포인트 및 막대 위에 수치 텍스트(% 및 백만원)를 직접 출력하는 커스텀 플러그인
    const cashTrendDataLabelsPlugin = {
        id: 'cashTrendDataLabelsPlugin',
        afterDatasetsDraw(chart) {
            const { ctx } = chart;
            ctx.save();

            chart.data.datasets.forEach((dataset, datasetIndex) => {
                const meta = chart.getDatasetMeta(datasetIndex);
                if (!meta.hidden) {
                    meta.data.forEach((element, index) => {
                        const val = dataset.data[index];
                        if (val !== null && val !== undefined) {
                            const pos = element.tooltipPosition ? element.tooltipPosition() : { x: element.x, y: element.y };
                            ctx.font = 'bold 11px "JetBrains Mono", sans-serif';
                            ctx.textAlign = 'center';

                            if (dataset.type === 'line') {
                                // 현금 비중 (%) - 선 포인트 상단에 초록색 텍스트
                                const text = `${val}%`;
                                ctx.fillStyle = '#4ade80';
                                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                                ctx.shadowBlur = 4;
                                ctx.fillText(text, pos.x, pos.y - 12);
                            } else if (dataset.type === 'bar') {
                                // 보유 현금액 (백만원) - 막대 상단에 골드 텍스트
                                const text = `${Number(val).toLocaleString()}백만`;
                                ctx.fillStyle = 'rgba(234, 179, 8, 1)';
                                ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                                ctx.shadowBlur = 4;
                                ctx.fillText(text, pos.x, pos.y - 8);
                            }
                        }
                    });
                }
            });
            ctx.restore();
        }
    };

    const ctx = canvas.getContext('2d');
    cashTrendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: '현금 비중 (%)',
                    data: ratioData,
                    borderColor: '#4ade80',
                    backgroundColor: 'rgba(74, 222, 128, 0.15)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.25,
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    pointBackgroundColor: '#4ade80',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    yAxisID: 'yRatio',
                    order: 1
                },
                {
                    type: 'bar',
                    label: '보유 현금액 (백만)',
                    data: cashData,
                    backgroundColor: 'rgba(212, 175, 55, 0.55)',
                    borderColor: 'rgba(212, 175, 55, 0.9)',
                    borderWidth: 1.5,
                    borderRadius: 6,
                    barThickness: 28,
                    maxBarThickness: 40,
                    yAxisID: 'yAmount',
                    order: 2
                }
            ]
        },
        plugins: [cashTrendDataLabelsPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.85)',
                        font: { size: 12, family: "'JetBrains Mono', monospace", weight: '600' },
                        boxWidth: 14,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#4ade80',
                    titleFont: { size: 13, weight: 'bold' },
                    bodyColor: '#f1f5f9',
                    bodyFont: { size: 12 },
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.dataset.yAxisID === 'yRatio') {
                                label += context.parsed.y + '%';
                            } else {
                                label += context.parsed.y.toLocaleString() + ' 백만원';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.85)', font: { size: 11, weight: '600' } }
                },
                yRatio: {
                    type: 'linear',
                    position: 'left',
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: '현금 비중 (%)',
                        color: '#4ade80',
                        font: { size: 11, weight: 'bold' }
                    },
                    ticks: {
                        color: '#4ade80',
                        callback: v => v + '%'
                    },
                    grid: { color: 'rgba(74, 222, 128, 0.12)' }
                },
                yAmount: {
                    type: 'linear',
                    position: 'right',
                    min: 0,
                    title: {
                        display: true,
                        text: '보유 현금액 (백만원)',
                        color: 'rgba(212, 175, 55, 0.95)',
                        font: { size: 11, weight: 'bold' }
                    },
                    ticks: {
                        color: 'rgba(212, 175, 55, 0.95)',
                        callback: v => v.toLocaleString()
                    },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

/**
 * 스냅샷 수동 편집 영역 토글
 */
function toggleSnapshotEditor() {
    const sec = document.getElementById('snapshot-editor-section');
    if (!sec) return;
    if (sec.style.display === 'none') {
        sec.style.display = 'block';
        renderSnapshotTable();
        // 기본달 지정
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const monthInput = document.getElementById('snap-input-month');
        if (monthInput && !monthInput.value) monthInput.value = `${year}-${month}`;
    } else {
        sec.style.display = 'none';
    }
}

/**
 * 스냅샷 관리 테이블 렌더링
 */
function renderSnapshotTable() {
    const tbody = document.getElementById('snapshot-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    const sortedData = [...monthlyCashSnapshots].sort((a, b) => a.month.localeCompare(b.month));

    if (sortedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:16px;">기록된 스냅샷이 없습니다.</td></tr>`;
        return;
    }

    sortedData.forEach((snap, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600; color:var(--gold-light);">${snap.month}</td>
            <td>${(snap.investment || 0).toLocaleString()} 백만</td>
            <td style="color:#4ade80;">${(snap.cash || 0).toLocaleString()} 백만</td>
            <td>${(snap.totalAsset || 0).toLocaleString()} 백만</td>
            <td style="font-weight:700; color:#4ade80;">${snap.ratio}%</td>
            <td>
                <button type="button" onclick="deleteSnapshot('${snap.month}')" class="cash-remove-btn" title="삭제" style="display:inline-block; padding:3px 6px;">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * 수동으로 스냅샷 추가/수정
 */
function addManualSnapshot() {
    const monthInput = document.getElementById('snap-input-month');
    const invInput = document.getElementById('snap-input-investment');
    const cashInput = document.getElementById('snap-input-cash');

    const month = monthInput ? monthInput.value.trim() : '';
    const investment = invInput ? parseFloat(invInput.value) || 0 : 0;
    const cash = cashInput ? parseFloat(cashInput.value) || 0 : 0;

    if (!month) {
        alert('연월(YYYY-MM)을 선택해주세요.');
        return;
    }

    const totalAsset = investment + cash;
    const ratio = totalAsset > 0 ? parseFloat((cash / totalAsset * 100).toFixed(1)) : 0;

    const existingIdx = monthlyCashSnapshots.findIndex(item => item.month === month);
    const newSnapshot = { month, investment, cash, totalAsset, ratio };

    if (existingIdx !== -1) {
        monthlyCashSnapshots[existingIdx] = newSnapshot;
    } else {
        monthlyCashSnapshots.push(newSnapshot);
    }

    monthlyCashSnapshots.sort((a, b) => a.month.localeCompare(b.month));
    saveSnapshotsToStorage();
    updateCashTrendChart();
    renderSnapshotTable();

    if (invInput) invInput.value = '';
    if (cashInput) cashInput.value = '';
}

/**
 * 특정 월 스냅샷 삭제
 */
function deleteSnapshot(monthKey) {
    if (!confirm(`[${monthKey}] 월별 스냅샷 기록을 삭제하시겠습니까?`)) return;
    monthlyCashSnapshots = monthlyCashSnapshots.filter(item => item.month !== monthKey);
    saveSnapshotsToStorage();
    updateCashTrendChart();
    renderSnapshotTable();
}

/**
 * 스냅샷 데이터 JSON 백업 다운로드
 */
function exportSnapshotsJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(monthlyCashSnapshots, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `cash_snapshots_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

/**
 * 백업 JSON 파일 트리거
 */
function triggerSnapshotImport() {
    const fileInput = document.getElementById('snapshot-file-input');
    if (fileInput) fileInput.click();
}

/**
 * 백업 JSON 파일 가져오기
 */
function importSnapshotsJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                monthlyCashSnapshots = imported;
                monthlyCashSnapshots.sort((a, b) => a.month.localeCompare(b.month));
                saveSnapshotsToStorage();
                updateCashTrendChart();
                renderSnapshotTable();
                alert(`${imported.length}개의 스냅샷을 성공적으로 불러왔습니다.`);
            } else {
                alert('올바른 스냅샷 JSON 형식이 아닙니다.');
            }
        } catch (err) {
            alert('JSON 파일 읽기 중 오류 발생: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// ===== 탐구생활 매매우선 연동 유틸리티 =====

function updateInvestigationPriorityCache(data) {
    if (!isExplorationSheet(data.current_sheet)) return;

    investigationPriorityCache.clear();
    if (!data.data || data.data.length === 0) return;

    const cols = data.columns || [];
    // 종목명이 있는 컬럼을 찾음 (findStockColumnName 함수 사용)
    const nameCol = findStockColumnName(cols);
    const momentumCol = cols.includes('모멘텀') ? '모멘텀' : 'Unnamed: 2';
    const strategyCol = cols.includes('매매 전략') ? '매매 전략' : 'Unnamed: 6'; // 매매 전략 컬럼 추가

    data.data.forEach(row => {
        const stockName = String(row[nameCol] || '').trim();
        const hasMomentum = row[momentumCol] && String(row[momentumCol]).trim() !== '';
        const hasStrategy = row[strategyCol] && String(row[strategyCol]).trim() !== ''; // 매매 전략 유무 체크

        // 모멘텀 또는 매매 전략 둘 중 하나라도 존재하고, 종목명이 유효하며 취소선(~~)이 없는 경우
        if (stockName && stockName !== '종목' && stockName !== 'stock' && !stockName.includes('~~') && (hasMomentum || hasStrategy)) {
            investigationPriorityCache.add(stockName);
        }
    });
}

async function fetchInvestigationPriorityData() {
    try {
        const timestamp = new Date().getTime();
        const sheetName = '탐구생활';
        let url;
        if (IS_GITHUB_PAGES) {
            const jsonFileName = GITHUB_JSON_MAP[sheetName];
            if (!jsonFileName) return;
            url = `${API}/${jsonFileName}?t=${timestamp}`;
        } else {
            url = `${API}/read-excel?file=${encodeURIComponent(TARGET_FILE)}&sheet=${encodeURIComponent(sheetName)}&t=${timestamp}`;
        }
        
        const res = await fetch(url);
        const data = await res.json();
        if (!data.error) {
            updateInvestigationPriorityCache(data);
        }
    } catch (e) {
        console.error('Failed to fetch investigation priority data:', e);
    }
}
// Version 1.0.1 - Cache Refresh

/**
 * 매매일지 종목별 투자금 트렌드 차트 (최근 6개월)
 */
/**
 * 매매일지 종목별 투자금 트렌드 차트 (최근 6개월)
 */
function updateJournalTrendChart() {
    const stockSelect = document.getElementById('journal-chart-stock-select');
    if (!stockSelect) return;
    
    let selectedStock = stockSelect.value.trim();
    
    // 만약 선택기에 값이 없으면 입력 폼에서 가져옴
    if (!selectedStock) {
        const stockInput = document.getElementById('trade-stock');
        if (stockInput) selectedStock = stockInput.value.trim();
    }

    const canvas = document.getElementById('journal-trend-chart');
    
    if (!canvas || !selectedStock || !currentData || currentData.current_sheet !== '매매일지') {
        if (journalTrendChart) {
            journalTrendChart.destroy();
            journalTrendChart = null;
        }
        return;
    }

    const ctx = canvas.getContext('2d');
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let labels = [];
    let values = [];
    let prices = [];
    let filteredWeeksData = []; // 총합용

    if (selectedStock === '총합') {
        const weeklyGroups = {};

        // 1. 매매일지 데이터 중 종목명이 유효하고 최근 6개월 이내인 거래 행 필터링
        const filteredData = currentData.data
            .filter(row => {
                const dateStr = row['Unnamed: 0'];
                const stockName = row['Unnamed: 1'];
                if (!dateStr || !stockName || stockName === '종목' || stockName === 'stock') return false;
                
                const date = new Date(dateStr);
                return !isNaN(date) && date >= sixMonthsAgo;
            });

        // 주차(월요일 기준) 계산 도우미 함수
        const getYearWeek = (date) => {
            const d = new Date(date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 월요일로 보정
            const monday = new Date(d.setDate(diff));
            monday.setHours(0, 0, 0, 0);
            return monday;
        };

        // 2. 각 거래 행을 해당 주차로 분류하여 수량(Unnamed: 2) X 단가(Unnamed: 3)를 곱하고 반올림하여 합산 (매도는 차감)
        filteredData.forEach(row => {
            const dateStr = row['Unnamed: 0'];
            const date = new Date(dateStr);
            
            const qty = parseFloat(row['Unnamed: 2']) || 0;
            const price = parseFloat(row['Unnamed: 3']) || 0;

            // 수량 * 단가 / 1,000,000을 반올림하여 백만원 단위 개수를 산출한 후 100을 곱함 (만원 단위로 맞춤)
            const tradeOnes = Math.round((qty * price) / 1000000);
            let numVal = tradeOnes * 100;

            // 매매구분(Unnamed: 4)이 '매도'인 경우 마이너스로 처리
            const tradeType = String(row['Unnamed: 4'] || '').trim();
            if (tradeType === '매도') {
                numVal = -Math.abs(numVal);
            } else {
                numVal = Math.abs(numVal);
            }

            const monday = getYearWeek(date);
            const mondayKey = monday.toISOString().split('T')[0];

            if (!weeklyGroups[mondayKey]) {
                weeklyGroups[mondayKey] = 0;
            }
            weeklyGroups[mondayKey] += numVal;
        });

        // 3. 주 단위 데이터를 배열로 변환 및 정렬
        const weeklyTotals = Object.entries(weeklyGroups).map(([mondayKey, total]) => {
            return {
                mondayKey,
                mondayDate: new Date(mondayKey),
                total
            };
        });
        weeklyTotals.sort((a, b) => a.mondayDate - b.mondayDate);
        
        // 현재 누적 투자금액 결정 (포트폴리오 맵 캐시 총합 또는 기본값 9,500만원)
        const currentTotal = Object.values(portfolioMapCache).reduce((a, b) => a + b, 0) || 9500; // 만원 단위
        
        // 누적 투자금액 역산
        const n = weeklyTotals.length;
        const cumulativeAmounts = new Array(n);
        
        if (n > 0) {
            // 가장 최신 주차의 누적 금액은 현재 금액
            cumulativeAmounts[n - 1] = currentTotal;
            
            // 역방향으로 이전 주차의 누적 금액 역산 (현재 주차 누적 - 현재 주차 변동 = 이전 주차 누적)
            for (let i = n - 1; i > 0; i--) {
                cumulativeAmounts[i - 1] = cumulativeAmounts[i] - weeklyTotals[i].total;
            }
        }

        filteredWeeksData = weeklyTotals.map((w, idx) => {
            return {
                ...w,
                cumulativeTotal: cumulativeAmounts[idx]
            };
        });

        labels = weeklyTotals.map(w => {
            const d = w.mondayDate;
            return `${d.getMonth() + 1}/${d.getDate()}`;
        });
        
        values = cumulativeAmounts.map(amount => amount / 100); // 만원 -> 백만원 단위 변환
        prices = []; // 총합 그래프에서는 단가가 없으므로 빈 배열
    } else {
        // 해당 종목의 최근 6개월 데이터 필터링
        const filteredData = currentData.data
            .filter(row => {
                const stockName = String(row['Unnamed: 1'] || '').trim();
                const dateStr = row['Unnamed: 0'];
                if (!dateStr || stockName !== selectedStock) return false;
                
                const date = new Date(dateStr);
                return !isNaN(date) && date >= sixMonthsAgo;
            })
            .sort((a, b) => new Date(a['Unnamed: 0']) - new Date(b['Unnamed: 0']));

        if (filteredData.length === 0) {
            if (journalTrendChart) {
                journalTrendChart.destroy();
                journalTrendChart = null;
            }
            return;
        }

        labels = filteredData.map(row => {
            const d = new Date(row['Unnamed: 0']);
            return `${d.getMonth() + 1}/${d.getDate()}`;
        });
        
        values = filteredData.map(row => {
            const val = row['Unnamed: 5'];
            const numVal = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '')) || 0;
            return numVal / 100; // 만원 -> 백만 단위로 변환
        });

        prices = filteredData.map(row => {
            const val = row['Unnamed: 3'];
            const numVal = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '')) || 0;
            return numVal;
        });
    }

    if (journalTrendChart) journalTrendChart.destroy();

    const journalDataLabelsPlugin = {
        id: 'journalDataLabelsPlugin',
        afterDatasetsDraw: (chart) => {
            const { ctx } = chart;
            ctx.save();
            ctx.textAlign = 'center';

            chart.data.datasets.forEach((dataset, i) => {
                if (i !== 0) return; // 첫 번째 데이터셋(투자금액) 기준으로만 라벨 표시
                
                const meta = chart.getDatasetMeta(i);
                meta.data.forEach((datapoint, index) => {
                    const amount = dataset.data[index];
                    
                    // 투자금액 (위)
                    ctx.font = 'bold 10px JetBrains Mono';
                    ctx.fillStyle = '#D4AF37';
                    
                    if (selectedStock === '총합') {
                        const weekData = filteredWeeksData[index];
                        const cumValText = Math.round(amount).toString();
                        
                        // 1. 누적 투자금액 (점 상단)
                        ctx.fillStyle = '#D4AF37';
                        ctx.fillText(cumValText, datapoint.x, datapoint.y - 32); // 3글자만큼 위로 올림
                        
                        // 2. 주 투자금액 증감 (점 하단)
                        if (weekData) {
                            const weeklyVal = Math.round(weekData.total / 100);
                            const sign = weeklyVal > 0 ? '+' : '';
                            const weeklyValText = `${sign}${weeklyVal}`;
                            
                            ctx.fillStyle = '#94A3B8'; // 증감액은 슬레이트 그레이 색상으로 구분
                            ctx.fillText(weeklyValText, datapoint.x, datapoint.y - 8); // 3글자만큼 위로 올림
                        }
                    } else {
                        const price = chart.data.datasets[1].data[index];
                        const amountText = Math.round(amount).toString();
                        ctx.fillText(amountText, datapoint.x, datapoint.y - 18);
                        
                        if (price !== undefined && price !== null) {
                            // 거래단가 (아래)
                            ctx.font = '9px JetBrains Mono';
                            ctx.fillStyle = '#94A3B8';
                            ctx.fillText(`(${price.toLocaleString()})`, datapoint.x, datapoint.y - 6);
                        }
                    }
                });
            });
            ctx.restore();
        }
    };

    const datasets = [
        {
            type: 'line',
            label: selectedStock === '총합' ? '누적 투자금 총액 (백만)' : '투자금액 (백만)',
            data: values,
            borderColor: '#D4AF37',
            backgroundColor: 'rgba(212, 175, 55, 0.1)',
            borderWidth: 2,
            pointRadius: 6, // 클릭하기 쉽게 포인트 크기 확대
            pointHoverRadius: 8,
            pointBackgroundColor: '#D4AF37',
            pointBorderColor: '#0A0E1A',
            pointBorderWidth: 2,
            tension: 0.3,
            fill: true,
            yAxisID: 'y'
        }
    ];

    if (selectedStock !== '총합') {
        datasets.push({
            type: 'line',
            label: '평균 단가',
            data: prices,
            borderColor: 'rgba(148, 163, 184, 0.4)',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [3, 3],
            pointRadius: 3,
            pointBackgroundColor: '#94A3B8',
            tension: 0.3,
            fill: false,
            yAxisID: 'y1'
        });
    }

    journalTrendChart = new Chart(ctx, {
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (selectedStock === '총합') return; // 총합일 때는 행 수정 모드 미작동
                if (elements.length > 0) {
                    const index = elements[0].index;
                    // 해당 종목의 최근 6개월 필터된 데이터 재계산
                    const filteredData = currentData.data
                        .filter(row => {
                            const stockName = String(row['Unnamed: 1'] || '').trim();
                            const dateStr = row['Unnamed: 0'];
                            if (!dateStr || stockName !== selectedStock) return false;
                            
                            const date = new Date(dateStr);
                            return !isNaN(date) && date >= sixMonthsAgo;
                        })
                        .sort((a, b) => new Date(a['Unnamed: 0']) - new Date(b['Unnamed: 0']));
                    
                    const row = filteredData[index];
                    const originalIndex = currentData.data.indexOf(row);
                    
                    if (originalIndex !== -1) {
                        setJournalEditMode(originalIndex, row);
                    }
                }
            },
            plugins: {
                legend: { 
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#94A3B8',
                        font: { size: 10 },
                        boxWidth: 10
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(10, 14, 26, 0.9)',
                    titleColor: '#D4AF37',
                    bodyColor: '#fff',
                    borderColor: 'rgba(212, 175, 55, 0.2)',
                    borderWidth: 1,
                    callbacks: {
                        title: (items) => {
                            const idx = items[0].dataIndex;
                            if (selectedStock === '총합') {
                                return `${filteredWeeksData[idx].mondayKey} 주차 (월요일 기준)`;
                            }
                            // 개별 종목인 경우 원래 로직 작동하도록
                            const filteredData = currentData.data
                                .filter(row => {
                                    const stockName = String(row['Unnamed: 1'] || '').trim();
                                    const dateStr = row['Unnamed: 0'];
                                    if (!dateStr || stockName !== selectedStock) return false;
                                    
                                    const date = new Date(dateStr);
                                    return !isNaN(date) && date >= sixMonthsAgo;
                                })
                                .sort((a, b) => new Date(a['Unnamed: 0']) - new Date(b['Unnamed: 0']));
                            return filteredData[idx]['Unnamed: 0'];
                        },
                        label: (context) => {
                            if (context.datasetIndex === 0) {
                                return `${selectedStock === '총합' ? '주간 투자금 총액' : '투자금'}: ${context.parsed.y.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}백만`;
                            } else {
                                if (selectedStock === '총합') return null;
                                return `평균단가: ${context.parsed.y.toLocaleString()}원`;
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { 
                        color: '#D4AF37', 
                        font: { size: 10 },
                        callback: (val) => val.toLocaleString() + 'M'
                    },
                    title: { display: true, text: '투자금 (M)', color: '#D4AF37', font: { size: 10 } }
                },
                y1: {
                    display: selectedStock !== '총합',
                    position: 'right',
                    beginAtZero: false,
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: '#94A3B8',
                        font: { size: 10 },
                        callback: (val) => val.toLocaleString()
                    },
                    title: { display: true, text: '거래단가', color: '#94A3B8', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748B', font: { size: 10 } }
                }
            },
            layout: {
                padding: { top: 25 } // 상단 라벨이 잘리지 않도록 여백 추가
            }
        },
        plugins: [journalDataLabelsPlugin]
    });
}

/**
 * 매매일지 수정 모드 설정
 */
function setJournalEditMode(rowIndex, data) {
    editingJournalRowIndex = rowIndex;
    
    // 입력 폼에 데이터 채우기
    document.getElementById('trade-date').value = data['Unnamed: 0'] || '';
    document.getElementById('trade-stock').value = data['Unnamed: 1'] || '';
    document.getElementById('trade-quantity').value = data['Unnamed: 2'] || '';
    document.getElementById('trade-price').value = data['Unnamed: 3'] || '';
    document.getElementById('trade-type').value = data['Unnamed: 4'] || '매수';
    document.getElementById('trade-amount').value = data['Unnamed: 5'] || '';
    
    // UI 변경
    const submitBtn = document.querySelector('#journal-form .btn-primary');
    const deleteBtn = document.getElementById('btn-delete-journal');
    
    if (submitBtn) {
        submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            수정하기
        `;
        submitBtn.classList.add('edit-mode');
    }
    
    if (deleteBtn) {
        deleteBtn.classList.remove('hidden');
    }
    
    // 폼으로 스크롤
    document.getElementById('journal-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    showToast(`${data['Unnamed: 1']} (${data['Unnamed: 0']}) 데이터를 수정합니다.`, 'info');
}

/**
 * 매매일지 폼 초기화 및 수정 모드 해제
 */
function resetJournalForm() {
    editingJournalRowIndex = null;
    const form = document.getElementById('journal-form');
    if (form) form.reset();
    
    const submitBtn = document.querySelector('#journal-form .btn-primary');
    const deleteBtn = document.getElementById('btn-delete-journal');
    
    if (submitBtn) {
        submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            저장하기
        `;
        submitBtn.classList.remove('edit-mode');
    }
    
    if (deleteBtn) {
        deleteBtn.classList.add('hidden');
    }
}

/**
 * 매매일지 항목 삭제
 */
async function deleteJournalEntry(e) {
    if (e) e.preventDefault();
    if (editingJournalRowIndex === null) return;
    
    const stockName = document.getElementById('trade-stock').value;
    const tradeDate = document.getElementById('trade-date').value;
    
    if (!confirm(`'${stockName}'의 ${tradeDate} 매매 기록을 삭제하시겠습니까?\n삭제 후 포트폴리오 현황이 이전 기록으로 되돌아갑니다.`)) {
        return;
    }
    
    try {
        const res = await fetch(`${API}/delete-row`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file: TARGET_FILE,
                sheet: '매매일지',
                rowIndex: editingJournalRowIndex
            })
        });
        
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const result = await res.json();
        if (result.success) {
            showToast('매매 기록이 삭제되고 포트폴리오가 업데이트되었습니다.', 'success');
            resetJournalForm();
            refreshData(true);
        } else {
            showToast('삭제 실패: ' + result.error, 'error');
        }
    } catch (err) {
        console.error('Delete error:', err);
        showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
}

// ===== 종목 초성 검색 및 자동완성 (매매일지용) =====
function getChosung(str) {
    const cho = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
    let result = "";
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i) - 44032;
        if (code > -1 && code < 11172) {
            result += cho[Math.floor(code / 588)];
        } else {
            result += str.charAt(i);
        }
    }
    return result;
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('trade-stock');
    const dropdown = document.getElementById('custom-stock-dropdown');
    let activeIndex = -1;
    
    if (!input || !dropdown) return;
    
    const getAllStocks = () => {
        const stocks = new Set(Object.keys(portfolioMapCache));
        
        if (currentData && currentData.data) {
            const stockCol = findStockColumnName(currentData.columns);
            currentData.data.forEach(row => {
                const stockName = String(row[stockCol] || row['Unnamed: 1'] || '').trim();
                if (stockName && stockName !== '종목' && stockName !== 'stock') {
                    // 취소선 태그 제거
                    const cleanName = stockName.replace(/~~/g, '');
                    stocks.add(cleanName);
                }
            });
        }
        
        return Array.from(stocks).sort();
    };

    const renderDropdown = (items, query) => {
        dropdown.innerHTML = '';
        if (items.length === 0) {
            dropdown.classList.add('hidden');
            return;
        }
        
        items.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            
            // 일치하는 부분 하이라이팅 처리
            const itemCho = getChosung(item);
            const queryCho = getChosung(query);
            const matchIndex = itemCho.indexOf(queryCho);
            
            if (matchIndex > -1) {
                const before = item.substring(0, matchIndex);
                const match = item.substring(matchIndex, matchIndex + query.length);
                const after = item.substring(matchIndex + query.length);
                div.innerHTML = `${escapeHtml(before)}<b>${escapeHtml(match)}</b>${escapeHtml(after)}`;
            } else {
                div.textContent = item;
            }
            
            div.dataset.value = item;
            
            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = item;
                dropdown.classList.add('hidden');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
            
            dropdown.appendChild(div);
        });
        dropdown.classList.remove('hidden');
        activeIndex = -1;
    };

    input.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) {
            dropdown.classList.add('hidden');
            return;
        }
        
        const allStocks = getAllStocks();
        const queryCho = getChosung(query);
        
        const matched = allStocks.filter(stock => {
            const stockCho = getChosung(stock);
            return stockCho.includes(queryCho) || stock.toLowerCase().includes(query);
        });
        
        // 최대 15개까지만 표시
        renderDropdown(matched.slice(0, 15), query);
    });
    
    input.addEventListener('keydown', (e) => {
        if (dropdown.classList.contains('hidden')) return;
        
        const items = dropdown.querySelectorAll('.autocomplete-item');
        if (items.length === 0) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % items.length;
            updateActive(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + items.length) % items.length;
            updateActive(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex > -1) {
                input.value = items[activeIndex].dataset.value;
                dropdown.classList.add('hidden');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.add('hidden');
        }
    });
    
    input.addEventListener('blur', () => {
        setTimeout(() => {
            dropdown.classList.add('hidden');
        }, 150);
    });
    
    input.addEventListener('focus', () => {
        if (input.value.trim()) {
            input.dispatchEvent(new Event('input'));
        }
    });

    const updateActive = (items) => {
        items.forEach((item, idx) => {
            if (idx === activeIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    };
});

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
    // 날짜 기본값 세팅 (최근 1년)
    setLsDateRange(0);
    
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
                
                // 폼 그리드 리스트로 렌더링
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
                });
                
                // 이벤트 위임을 통한 동적 투자금 재계산
                if (listContainer) {
                    // 이전 리스너 방지를 위해 클론
                    const newContainer = listContainer.cloneNode(true);
                    listContainer.parentNode.replaceChild(newContainer, listContainer);
                    
                    newContainer.addEventListener('input', (e) => {
                        if (e.target.classList.contains('ls-trade-qty') || e.target.classList.contains('ls-trade-price') || e.target.classList.contains('ls-trade-name') || e.target.classList.contains('ls-trade-type')) {
                            const idx = e.target.dataset.idx;
                            const qtyInput = document.querySelector(`.ls-trade-qty[data-idx="${idx}"]`);
                            const priceInput = document.querySelector(`.ls-trade-price[data-idx="${idx}"]`);
                            const nameInput = document.querySelector(`.ls-trade-name[data-idx="${idx}"]`);
                            const typeInput = document.querySelector(`.ls-trade-type[data-idx="${idx}"]`);
                            const invInput = document.querySelector(`.ls-trade-inv[data-idx="${idx}"]`);
                            
                            if (qtyInput && priceInput && nameInput && typeInput && invInput) {
                                const qty = parseFloat(qtyInput.value) || 0;
                                const price = parseFloat(priceInput.value) || 0;
                                const stockName = nameInput.value.trim();
                                const isSell = typeInput.value.trim() === '매도';
                                
                                const baseAmount = portfolioMapCache[stockName] || 0;
                                const tradeOnes = Math.round((qty * price) / 1000000);
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
                                
                                invInput.value = computedInvestment;
                            }
                        }
                    });
                }

                
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

function groupLsTrades() {
    if (!lsImportData || lsImportData.length === 0) return;
    
    // 현재 입력되어 있는 값들을(수량, 가격 등) 먼저 lsImportData에 임시 반영
    const cbs = document.querySelectorAll('.ls-trade-cb');
    cbs.forEach(cb => {
        const idx = parseInt(cb.dataset.idx, 10);
        const qtyInput = document.querySelector(`.ls-trade-qty[data-idx="${idx}"]`);
        const priceInput = document.querySelector(`.ls-trade-price[data-idx="${idx}"]`);
        const nameInput = document.querySelector(`.ls-trade-name[data-idx="${idx}"]`);
        const typeInput = document.querySelector(`.ls-trade-type[data-idx="${idx}"]`);
        const invInput = document.querySelector(`.ls-trade-inv[data-idx="${idx}"]`);
        
        if (qtyInput) lsImportData[idx].qty = parseFloat(qtyInput.value) || 0;
        if (priceInput) lsImportData[idx].price = parseFloat(priceInput.value) || 0;
        if (nameInput) lsImportData[idx].name = nameInput.value.trim();
        if (typeInput) lsImportData[idx].type = typeInput.value.trim();
        if (invInput) lsImportData[idx].investment = parseFloat(invInput.value) || 0;
    });

    const grouped = new Map();
    
    lsImportData.forEach(t => {
        const key = `${t.date}_${t.ticker}_${t.type}`;
        if (!grouped.has(key)) {
            grouped.set(key, { ...t });
        } else {
            const existing = grouped.get(key);
            existing.qty += t.qty;
            existing.price = Math.max(existing.price, t.price);
            existing.amount += t.amount;
            existing.fee += t.fee;
            
            // 투자금: 단순히 합치기 (나중에 랜더링시 포트폴리오 금액 고려해 다시 계산됨)
            existing.investment += t.investment;
        }
    });

    const result = Array.from(grouped.values());
    result.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return a.type.localeCompare(b.type);
    });
    
    lsImportData = result;
    
    // UI 다시 그리기 (기존 렌더링 로직 일부 재사용)
    document.getElementById('ls-result-count').textContent = `조회 결과: ${lsImportData.length}건 (합치기 완료)`;
    const listContainer = document.getElementById('ls-trades-list');
    if (listContainer) {
        listContainer.innerHTML = '';
        lsImportData.forEach((trade, idx) => {
            const div = document.createElement('div');
            div.className = 'journal-form-container';
            div.style.padding = '15px';
            div.style.marginBottom = '10px';
            div.style.position = 'relative';
            
            const isSell = trade.type === '매도';
            const typeColor = isSell ? '#EF4444' : '#00F2FE';
            
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
            listContainer.appendChild(div);
        });
    }
    showToast('동일한 날짜, 종목, 매매종류의 거래가 합쳐졌습니다.', 'success');
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
        
        // 사용자가 수정한 값 반영 (0이나 빈 문자열 등도 정상 반영되도록 || 대신 조건문 처리)
        const dateInput = document.querySelector(`.ls-trade-date[data-idx="${idx}"]`);
        if (dateInput) {
            const val = dateInput.value.trim();
            if (val !== "") trade.date = val;
        }
        
        const nameInput = document.querySelector(`.ls-trade-name[data-idx="${idx}"]`);
        if (nameInput) {
            const val = nameInput.value.trim();
            if (val !== "") trade.name = val;
        }
        
        const qtyInput = document.querySelector(`.ls-trade-qty[data-idx="${idx}"]`);
        if (qtyInput) {
            const val = parseFloat(qtyInput.value);
            if (!isNaN(val)) trade.qty = val;
        }
        
        const priceInput = document.querySelector(`.ls-trade-price[data-idx="${idx}"]`);
        if (priceInput) {
            const val = parseFloat(priceInput.value);
            if (!isNaN(val)) trade.price = val;
        }
        
        const typeInput = document.querySelector(`.ls-trade-type[data-idx="${idx}"]`);
        if (typeInput) {
            const val = typeInput.value.trim();
            if (val !== "") trade.type = val;
        }
        
        const invInput = document.querySelector(`.ls-trade-inv[data-idx="${idx}"]`);
        if (invInput) {
            const val = parseFloat(invInput.value);
            if (!isNaN(val)) trade.investment = val;
        }
        
        trade.memo = ''; // 메모 필드는 삭제됨
        
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

window.saveTargetPrice = async function(stock, value) {
    try {
        const num = parseInt(value.replace(/[^0-9]/g, ''), 10);
        if (isNaN(num)) {
            delete window.targetPricesCache[stock];
        } else {
            window.targetPricesCache[stock] = num;
        }
        
        const resPost = await fetch(`${API}/target-prices`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(window.targetPricesCache)
        });
        
        if (resPost.ok) {
            showToast(`${stock} 목표가 저장 완료`, 'success');
            refreshSignalPrices(); // 도달 여부 즉시 반영
        } else {
            showToast('목표가 저장 실패', 'error');
        }
    } catch(e) {
        showToast('목표가 저장 오류', 'error');
    }
};

window.saveTargetDate = async function(stock, value) {
    try {
        if (!value) {
            delete window.targetDatesCache[stock];
        } else {
            window.targetDatesCache[stock] = value;
        }
        
        const resPost = await fetch(`${API}/target-dates`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(window.targetDatesCache)
        });
        
        if (resPost.ok) {
            showToast(`${stock} 목표 시점 저장 완료`, 'success');
            refreshSignalPrices(); // 도달 여부 즉시 반영
        } else {
            showToast('목표 시점 저장 실패', 'error');
        }
    } catch(e) {
        showToast('목표 시점 저장 오류', 'error');
    }
};
