/**
 * Excel Viewer - 주식 체크 리스트 고정 뷰어
 */

const API = 'http://localhost:5000/api';
const TARGET_FILE = '주식 체크 리스트_20220328.xlsx';
let currentData = null;

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        const res = await fetch(`${API}/onedrive-status`);
        const data = await res.json();
        const badge = document.getElementById('connection-status');
        
        if (data.connected) {
            badge.className = 'connection-badge connected';
            badge.querySelector('.status-text').textContent = 'OneDrive 연결됨';
            // 파일 자동 로드
            loadExcel(TARGET_FILE);
        } else {
            badge.className = 'connection-badge disconnected';
            badge.querySelector('.status-text').textContent = '연결 안됨';
            showToast('OneDrive 연결을 확인해주세요.', 'error');
        }
    } catch {
        showToast('서버 연결 실패', 'error');
    }
}

// ===== 엑셀 데이터 로드 =====
async function loadExcel(filePath, sheetName = null) {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('hidden');
    
    try {
        let url = `${API}/read-excel?file=${encodeURIComponent(filePath)}`;
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
        
        renderSheetTabs(data.sheet_names, data.current_sheet);
        renderTable(data);
    } catch(e) {
        showToast('데이터 로드 중 오류가 발생했습니다.', 'error');
    } finally {
        overlay.classList.add('hidden');
    }
}

// ===== 시트 탭 렌더링 =====
function renderSheetTabs(sheets, activeSheet) {
    const container = document.getElementById('sheet-tabs');
    container.innerHTML = sheets.map(name => `
        <button class="sheet-tab ${name === activeSheet ? 'active' : ''}" 
                onclick="loadExcel('${currentData._filePath}', '${name}')">
            ${name}
        </button>
    `).join('');
}

// ===== 테이블 렌더링 =====
function renderTable(data) {
    const thead = document.getElementById('table-head');
    thead.innerHTML = `<tr>${data.columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
    renderTableRows(data.data, data.columns);
}

function renderTableRows(rows, cols) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = rows.map(r => `
        <tr>${cols.map(c => `<td>${r[c] !== undefined ? r[c] : ''}</td>`).join('')}</tr>
    `).join('');
}

// ===== 검색/필터 =====
function filterTable() {
    if (!currentData) return;
    const q = document.getElementById('table-search').value.toLowerCase();
    const filtered = currentData.data.filter(r => 
        currentData.columns.some(c => String(r[c]).toLowerCase().includes(q))
    );
    renderTableRows(filtered, currentData.columns);
}

function refreshData() {
    if (currentData) loadExcel(currentData._filePath, currentData.current_sheet);
    else init();
}

function showToast(msg, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
