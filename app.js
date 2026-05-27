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
let investigationRowMap = [];
let selectedInvestigationRowIndex = null;
let investigationCurrentRows = [];
let journalTrendChart = null;
let editingJournalRowIndex = null; // 수정 중인 매매일지 행 인덱스

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
        if (e.ctrlKey && e.key === 's' && !e.shiftKey && !e.altKey && !e.metaKey) {
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

    container.innerHTML = filteredSheets.map(name => `
        <button class="sheet-tab ${name === activeSheet ? 'active' : ''}" 
                onclick="loadExcel('${currentData._filePath}', '${name}')">
            ${name}
        </button>
    `).join('');
}

let portfolioChart = null;

const INVESTIGATION_STICKY_HEADERS = ['번호', '종목명', '모델명', '모델', '매수 이유', '리스크', '대표', '매매 전략'];

function getInvestigationStickyIndices(columns) {
    const lowerHeaders = columns.map(c => String(mapColumnLabel(c) || '').toLowerCase());
    const index = lowerHeaders.findIndex(c => INVESTIGATION_STICKY_HEADERS.some(key => c.includes(key.toLowerCase())));
    if (index !== -1) {
        return Array.from({ length: Math.min(7, columns.length - index) }, (_, idx) => index + idx);
    }
    return Array.from({ length: Math.min(7, columns.length) }, (_, idx) => idx);
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

    if (data.current_sheet === '매매일지') {
        if (chartPanel) chartPanel.classList.add('hidden');
        if (journalPanel) journalPanel.classList.remove('hidden');
        if (tablePanel) tablePanel.classList.remove('hidden'); // 테이블 표시 추가
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
        updateChart(data, null);
        return;
    }

    if (data.current_sheet === '실적') {
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
        document.querySelector('.summary-stats').classList.remove('hidden');

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
                    ctx.fillText(`${g.amount.toLocaleString()}백만`, centerX, bottom + 82); // 금액
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
            return `<td class="${className}">${displayVal}</td>`;
        }).join('')}
        </tr>
    `;
    }).join('');

    if (currentData && isExplorationSheet(currentData.current_sheet)) {
        investigationRowMap = map;
        investigationCurrentRows = rows;
        const rowsEls = tbody.querySelectorAll('tr');
        rowsEls.forEach(rowEl => {
            const originalIndex = parseInt(rowEl.dataset.originalIndex, 10);
            rowEl.addEventListener('click', () => setSelectedInvestigationRow(originalIndex));
            rowEl.querySelectorAll('td').forEach((td, colIndex) => {
                td.contentEditable = true;
                td.dataset.rowIndex = originalIndex;
                td.dataset.colKey = cols[colIndex];
                td.addEventListener('blur', handleInvestigationCellBlur);
                td.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && e.shiftKey) {
                        // Shift+Enter: 줄바꿈 삽입
                        e.preventDefault();
                        document.execCommand('insertLineBreak');
                    } else if (e.key === 'Enter' && !e.shiftKey) {
                        // Enter만: 저장(blur)
                        e.preventDefault();
                        td.blur();
                    }
                });
            });
        });
    } else if (currentData && currentData.current_sheet === '매매일지') {
        const rowsEls = tbody.querySelectorAll('tr');
        rowsEls.forEach(rowEl => {
            const originalIndex = parseInt(rowEl.dataset.originalIndex, 10);
            rowEl.style.cursor = 'pointer';
            rowEl.addEventListener('click', () => {
                const rowData = displayRows.find((_, i) => map[i] === originalIndex);
                if (rowData) {
                    setJournalEditMode(originalIndex, rowData);
                }
            });
        });
    }
}

function renderInvestigationPanel(data) {
    const panel = document.getElementById('investigation-panel');
    if (!panel) return;
    panel.classList.remove('hidden');
    investigationRowMap = data.data.map((_, idx) => idx);
    investigationCurrentRows = data.data;

    // 종목명 datalist 업데이트
    updateInvestigationStockList(data);
    // 좌측 카드 목록 렌더링
    renderInvestigationCards(data.data, data.columns);

    // 첫 번째 항목 자동 선택
    if (data.data.length > 0) {
        if (selectedInvestigationRowIndex === null || selectedInvestigationRowIndex >= data.data.length) {
            selectedInvestigationRowIndex = 0;
        }
        setSelectedInvestigationRow(selectedInvestigationRowIndex);
    }
}

function mapColumnLabel(columnName) {
    if (columnName === 'Unnamed: 0') return '번호';
    if (columnName === 'Unnamed: 1') return '종목명';
    if (columnName === 'Unnamed: 2') return '모멘텀(시점)';
    if (columnName === 'Unnamed: 3') return '매수 이유';
    if (columnName === 'Unnamed: 4') return '리스크';
    if (columnName === 'Unnamed: 5') return '대표';
    if (columnName === 'Unnamed: 6') return '매매전략';
    return columnName;
}

/**
 * 좌측 카드 목록 렌더링 (번호 + 종목명만 표시)
 */
function renderInvestigationCards(rows, cols, rowMap = null) {
    const container = document.getElementById('investigation-card-list');
    if (!container) return;
    const map = rowMap || rows.map((_, idx) => idx);
    investigationRowMap = map;
    investigationCurrentRows = rows;

    // 종목명 및 모멘텀 컬럼 찾기
    const numCol = cols[0];  // 번호
    const nameCol = findStockColumnName(cols); // 종목명
    const momentumCol = 'Unnamed: 2'; // 모멘텀(시점)

    container.innerHTML = rows.map((row, index) => {
        const originalIndex = map[index];
        const isActive = originalIndex === selectedInvestigationRowIndex;
        const numVal = row[numCol] !== undefined ? row[numCol] : '';
        const nameVal = row[nameCol] !== undefined ? row[nameCol] : '(이름 없음)';
        const displayTitle = String(nameVal).replace(/~~(.*?)~~/g, '<del>$1</del>');
        const isCancelled = String(nameVal).includes('~~');

        // 모멘텀 데이터 존재 여부 확인
        const hasMomentum = row[momentumCol] && String(row[momentumCol]).trim() !== '';

        return `
            <div class="investigation-card${isActive ? ' selected' : ''}${isCancelled ? ' cancelled' : ''}" data-original-index="${originalIndex}">
                <div class="investigation-card-header">
                    <div class="investigation-card-title ${hasMomentum ? 'has-momentum' : ''}">${displayTitle}</div>
                    <div class="investigation-card-subtitle">${numVal}</div>
                </div>
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

    // 컬럼별 editable div 생성 (번호 컬럼은 읽기 전용으로)
    form.innerHTML = cols.map((col, idx) => {
        const label = mapColumnLabel(col);
        const rawValue = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
        // ~~텍스트~~를 <del>텍스트</del>로 변환하여 시각화
        const displayValue = rawValue.replace(/\n/g, '<br>').replace(/~~(.*?)~~/g, '<del>$1</del>');
        const isSingleLine = (idx === 0 || col === nameCol); // 번호 또는 종목명 컬럼

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
                const isDuplicate = currentData.data.some((row, idx) => {
                    if (idx === rIdx) return false;
                    const existingName = String(row[nameCol] || '').trim();
                    // 취소선(~~) 제거 후 비교하여 동일 종목인지 판단
                    const cleanExisting = existingName.replace(/~~/g, '');
                    const cleanNew = newValue.trim().replace(/~~/g, '');
                    return cleanExisting === cleanNew;
                });

                if (isDuplicate) {
                    alert(`'${newValue.replace(/~~/g, '')}'은(는) 이미 존재하는 종목명입니다.\n중복된 종목명은 저장할 수 없습니다.`);
                    // 원래 값으로 복구
                    const originalValue = String(currentData.data[rIdx][colKey] || '');
                    ed.innerHTML = originalValue.replace(/\n/g, '<br>').replace(/~~(.*?)~~/g, '<del>$1</del>');
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
            }

            saveInvestigationRow(rIdx, currentData.data[rIdx]);
        });
    });
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
    setSelectedInvestigationRow(0);
}

/**
 * 매매 우선: 모멘텀(시점) 데이터가 있는 종목만 필터링하여 표시
 */
function filterMomentumStocks() {
    if (!currentData || !isExplorationSheet(currentData.current_sheet)) return;

    const momentumCol = 'Unnamed: 2'; // 모멘텀(시점)
    const filtered = [];
    const rowMap = [];

    currentData.data.forEach((row, idx) => {
        const momentum = String(row[momentumCol] || '').trim();
        if (momentum !== '') {
            filtered.push(row);
            rowMap.push(idx);
        }
    });

    if (filtered.length === 0) {
        showToast('매매 우선 데이터(모멘텀)가 있는 종목이 없습니다.', 'info');
        return;
    }

    renderInvestigationCards(filtered, currentData.columns, rowMap);
    if (rowMap.length > 0) {
        setSelectedInvestigationRow(rowMap[0]);
    }
    showToast(`${filtered.length}개의 매매 우선 종목을 찾았습니다.`, 'success');
}

/**
 * 탐구생활 신규 종목 추가 준비
 * 마지막 번호를 자동으로 계산하여 입력창을 초기화하고 새 행을 생성합니다.
 */
function prepareNewInvestigationRow() {
    if (!currentData || !isExplorationSheet(currentData.current_sheet)) return;

    // 1. 마지막 번호 찾기 (Unnamed: 0 컬럼 기준)
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
    newRow['Unnamed: 0'] = nextNum; // 번호 설정

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
    // <del> 태그를 ~~텍스트~~ 형식으로 변환 (취소선 정보 유지)
    clone.querySelectorAll('del').forEach(del => {
        const text = del.textContent;
        del.replaceWith(`~~${text}~~`);
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
        const isDuplicate = currentData.data.some((r, idx) => {
            if (idx === rowIndex) return false;
            const existingName = String(r[nameCol] || '').trim();
            const cleanExisting = existingName.replace(/~~/g, '');
            const cleanNew = newValue.trim().replace(/~~/g, '');
            return cleanExisting === cleanNew;
        });

        if (isDuplicate) {
            alert(`'${newValue.replace(/~~/g, '')}'은(는) 이미 존재하는 종목명입니다.\n중복된 종목명은 저장할 수 없습니다.`);
            // 원래 값으로 복구
            td.innerHTML = String(row[colKey] || '').replace(/\n/g, '<br>').replace(/~~(.*?)~~/g, '<del>$1</del>');
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

function filterTable() {
    if (!currentData) return;
    const q = document.getElementById('table-search').value.toLowerCase();
    const filtered = currentData.data.filter(r =>
        currentData.columns.some(c => String(r[c]).toLowerCase().includes(q))
    );
    renderTableRows(filtered, currentData.columns);
    const select = document.getElementById('chart-col-select');
    if (select) updateChart({ ...currentData, data: filtered }, select.value);
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
        autoRefreshTimer = setInterval(() => refreshData(true), REFRESH_INTERVAL);
    } else {
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
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

        const range = selection.getRangeAt(0);

        // 선택 영역에 이미 취소선이 적용되어 있는지 확인
        let isInStrikethrough = false;
        let elementToCheck = range.commonAncestorContainer;
        if (elementToCheck.nodeType === Node.TEXT_NODE) elementToCheck = elementToCheck.parentElement;

        let delElement = null;
        let temp = elementToCheck;
        while (temp && temp !== activeEl) {
            if (temp.tagName === 'DEL') {
                isInStrikethrough = true;
                delElement = temp;
                break;
            }
            temp = temp.parentElement;
        }

        try {
            if (isInStrikethrough) {
                const textNode = document.createTextNode(delElement.textContent);
                delElement.parentNode.replaceChild(textNode, delElement);
                showToast('취소선이 해제되었습니다.', 'success');
            } else {
                const del = document.createElement('del');
                range.surroundContents(del);
                showToast('취소선이 적용되었습니다.', 'success');
            }
        } catch (e) {
            showToast('복잡한 선택 영역에서는 취소선을 적용할 수 없습니다.', 'warning');
            return;
        }

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

    const labels = filteredData.map(row => {
        const d = new Date(row['Unnamed: 0']);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    
    const values = filteredData.map(row => {
        const val = row['Unnamed: 5'];
        const numVal = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '')) || 0;
        return numVal / 100; // 만원 -> 백만 단위로 변환
    });

    const prices = filteredData.map(row => {
        const val = row['Unnamed: 3'];
        const numVal = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '')) || 0;
        return numVal;
    });

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
                    const price = chart.data.datasets[1].data[index];
                    
                    // 투자금액 (위)
                    ctx.font = 'bold 10px JetBrains Mono';
                    ctx.fillStyle = '#D4AF37';
                    ctx.fillText(amount.toFixed(1), datapoint.x, datapoint.y - 18);
                    
                    // 거래단가 (아래)
                    ctx.font = '9px JetBrains Mono';
                    ctx.fillStyle = '#94A3B8';
                    ctx.fillText(`(${price.toLocaleString()})`, datapoint.x, datapoint.y - 6);
                });
            });
            ctx.restore();
        }
    };

    journalTrendChart = new Chart(ctx, {
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: '투자금액 (백만)',
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
                },
                {
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
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
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
                            return filteredData[idx]['Unnamed: 0'];
                        },
                        label: (context) => {
                            if (context.datasetIndex === 0) {
                                return `투자금: ${context.parsed.y.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}백만`;
                            } else {
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
