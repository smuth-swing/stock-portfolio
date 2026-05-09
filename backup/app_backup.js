/**
 * Excel Viewer - 주식 체크 리스트 고정 뷰어
 */

const API = 'http://localhost:5000/api';
const TARGET_FILE = '주식 체크 리스트_20220328.xlsx';
let currentData = null;
let autoRefreshTimer = null;
const REFRESH_INTERVAL = 30000; // 30초
let portfolioMapCache = {}; // { 종목명: 기본투자금(만원) }

// ===== 서버 자동 재연결 설정 =====
let reconnectTimer = null;        // 재연결 타이머
let reconnectCount = 0;           // 재연결 시도 횟수
const RECONNECT_INTERVAL = 5000;  // 5초마다 재연결 시도
const MAX_RECONNECT = 60;         // 최대 60회 (5분)

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', init);

async function init() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('hidden');
    
    // 매매일지 자동 투자금 계산 및 반올림 로직
    const quantityInput = document.getElementById('trade-quantity');
    const priceInput = document.getElementById('trade-price');
    const amountInput = document.getElementById('trade-amount');

    const calculateAmount = () => {
        const stockName = String(document.getElementById('trade-stock').value || '').trim();
        const qty = parseFloat(quantityInput.value) || 0;
        const price = parseFloat(priceInput.value) || 0;
        
        // 포트폴리오 맵에서 기본값 가져오기
        const baseAmount = portfolioMapCache[stockName] || 0;
        
        if (qty > 0 && price > 0) {
            const total = qty * price;
            // 백만원 단위로 반올림 후 만원 단위로 변환 (1,560,000 -> 2,000,000 -> 200)
            const roundedInWon = Math.round(total / 1000000) * 1000000;
            const currentTradeAmount = roundedInWon / 10000;
            
            // 기본값 + 현재 매매 금액
            amountInput.value = baseAmount + currentTradeAmount;
        } else if (baseAmount > 0) {
            // 수량/단가 없어도 기본값이 있으면 표시
            amountInput.value = baseAmount;
        } else {
            amountInput.value = '';
        }
    };

    if (quantityInput && priceInput && amountInput) {
        quantityInput.addEventListener('input', calculateAmount);
        priceInput.addEventListener('input', calculateAmount);
        // 종목명 입력 시에도 계산 트리거
        document.getElementById('trade-stock').addEventListener('input', calculateAmount);
        document.getElementById('trade-stock').addEventListener('change', calculateAmount);
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
                const res = await fetch(`${API}/save-journal`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file: TARGET_FILE,
                        sheet: '매매일지',
                        row: rowData
                    })
                });
                
                const result = await res.json();
                if (result.success) {
                    showToast('매매일지가 성공적으로 저장되었습니다.', 'success');
                    journalForm.reset();
                    refreshData(true); // 데이터 새로고침
                } else {
                    showToast('저장 실패: ' + result.error, 'error');
                }
            } catch (err) {
                console.error('Save error:', err);
                showToast('저장 중 오류가 발생했습니다.', 'error');
            }
        };
    }
    
    try {
        const res = await fetch(`${API}/onedrive-status`);
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
            showToast('서버에 연결할 수 없습니다. 서버 상태를 확인하세요.', 'error');
            console.warn('[재연결] 최대 시도 횟수 초과. 재연결 중단.');
            return;
        }
        
        // 상태 표시 업데이트
        badge.querySelector('.status-text').textContent = `재연결 중... (${reconnectCount}/${MAX_RECONNECT})`;
        console.log(`[재연결] ${reconnectCount}/${MAX_RECONNECT}회 시도 중...`);
        
        try {
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
    
    try {
        // 캐시 방지를 위해 타임스탬프 추가
        const timestamp = new Date().getTime();
        let url = `${API}/read-excel?file=${encodeURIComponent(filePath)}&t=${timestamp}`;
        if (sheetName) url += `&sheet=${encodeURIComponent(sheetName)}`;
        
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
        } else if (!Object.keys(portfolioMapCache).length) {
            // 캐시가 비어있으면 포트폴리오 맵 데이터를 별도로 요청하여 캐시 채움
            fetchPortfolioMapData();
        }
    } catch(e) {
        showToast('데이터 로드 중 오류가 발생했습니다.', 'error');
    } finally {
        overlay.classList.add('hidden');
    }
}

function renderSheetTabs(sheets, activeSheet) {
    const container = document.getElementById('sheet-tabs');
    container.innerHTML = sheets.map(name => `
        <button class="sheet-tab ${name === activeSheet ? 'active' : ''}" 
                onclick="loadExcel('${currentData._filePath}', '${name}')">
            ${name}
        </button>
    `).join('');
}

let portfolioChart = null;

function renderTable(data) {
    const thead = document.getElementById('table-head');
    thead.innerHTML = `<tr>${data.columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
    renderTableRows(data.data, data.columns);
    renderChart(data);
}

function renderChart(data) {
    const ctx = document.getElementById('portfolio-chart');
    if (!ctx) return;

    const controls = document.getElementById('chart-controls');
    
    const chartPanel = document.querySelector('.chart-panel');
    const journalPanel = document.getElementById('journal-panel');
    
    if (data.current_sheet === '매매일지') {
        if (chartPanel) chartPanel.classList.add('hidden');
        if (journalPanel) journalPanel.classList.remove('hidden');
        
        // 종목명 추천 목록(datalist) 업데이트
        const datalist = document.getElementById('stock-list');
        if (datalist) {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const stocks = new Set();
            
            data.data.forEach(row => {
                const dateStr = row['Unnamed: 0'];
                const stockName = row['Unnamed: 1'];
                if (dateStr && stockName) {
                    const rowDate = new Date(dateStr);
                    if (!isNaN(rowDate) && rowDate >= oneYearAgo) {
                        stocks.add(String(stockName).trim());
                    }
                }
            });
            
            datalist.innerHTML = Array.from(stocks)
                .sort()
                .map(stock => `<option value="${stock}">`)
                .join('');
        }
        return;
    } else {
        if (chartPanel) chartPanel.classList.remove('hidden');
        if (journalPanel) journalPanel.classList.add('hidden');
    }

    if (data.current_sheet === '포트폴리오 맵') {
        controls.innerHTML = '<span class="badge">전체 투자 현황 (합산)</span>';
        updateChart(data, null);
        return;
    }

    const numericCols = data.numeric_columns || [];
    if (numericCols.length === 0) {
        controls.innerHTML = '<span class="text-muted" style="font-size:12px;">숫자 데이터가 없습니다.</span>';
        if (portfolioChart) portfolioChart.destroy();
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

    if (data.current_sheet === '포트폴리오 맵') {
        labelName = '전략/종목군별 투자 금액 (만원)';
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
                    const rowAmount = countOfOnes * 100;
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
                    ctx.fillText(`${g.amount.toLocaleString()}만`, centerX, bottom + 82); // 금액
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

function renderTableRows(rows, cols) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = rows.map(r => `
        <tr>${cols.map(c => `<td>${r[c] !== undefined && r[c] !== null ? r[c] : ''}</td>`).join('')}</tr>
    `).join('');
}

function filterTable() {
    if (!currentData) return;
    const q = document.getElementById('table-search').value.toLowerCase();
    const filtered = currentData.data.filter(r => 
        currentData.columns.some(c => String(r[c]).toLowerCase().includes(q))
    );
    renderTableRows(filtered, currentData.columns);
    const select = document.getElementById('chart-col-select');
    if (select) updateChart({...currentData, data: filtered}, select.value);
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

// ===== 포트폴리오 맵 연동 유틸리티 =====

function updatePortfolioMapCache(data) {
    if (data.current_sheet !== '포트폴리오 맵') return;
    
    portfolioMapCache = {};
    const stockCol = 'Unnamed: 3';
    const startColIndex = data.columns.indexOf('Unnamed: 4');
    const amountCols = startColIndex !== -1 ? data.columns.slice(startColIndex) : [];
    
    data.data.forEach(row => {
        const stockName = String(row[stockCol] || '').trim();
        if (stockName && stockName !== '종목' && stockName !== '') {
            let countOfOnes = 0;
            amountCols.forEach(col => {
                const val = parseFloat(row[col]);
                if (val === 1) countOfOnes++;
            });
            if (countOfOnes > 0) {
                portfolioMapCache[stockName] = countOfOnes * 100; // 만원 단위
            }
        }
    });
    console.log('Portfolio Map Cache Updated:', portfolioMapCache);
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
