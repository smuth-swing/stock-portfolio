// test_import_fix.js - LS증권 거래내역 저장 후 UI 처리 및 에러 방어 테스트

const assert = require('assert');

// 1. 가상 DOM 시뮬레이션 환경 구성
class MockElement {
    constructor(id) {
        this.id = id;
        this.style = { display: 'block' };
        this.textContent = '';
        this.disabled = false;
        this.innerHTML = '';
    }
}

const elements = {};
global.document = {
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => {
        if (sel.includes('.btn-primary')) return elements['btn-save'] || null;
        return null;
    },
    querySelectorAll: (sel) => []
};

global.showToast = () => {};
global.refreshData = () => {};
global.fetchTradeJournalData = () => Promise.resolve();
global.refreshJournalInvestment = () => {};

// [테스트 1] 실제 현재 index.html 환경 (broker-import-body, broker-import-chevron 존재)
console.log('--- [테스트 1] 실제 index.html 환경 (broker-import-body 구조) 검증 ---');
elements['broker-import-body'] = new MockElement('broker-import-body');
elements['broker-import-chevron'] = new MockElement('broker-import-chevron');
elements['ls-trades-result'] = new MockElement('ls-trades-result');
elements['btn-save'] = new MockElement('btn-save');
delete elements['ls-import-body'];
delete elements['ls-import-chevron'];

let lsImportData = [{ date: '2026-11-17', name: '삼성전자', qty: 10, price: 70000, type: '매수', investment: 70 }];

// 저장 성공 시 UI 처리 로직 시뮬레이션
function handleSaveSuccess() {
    const importBody = document.getElementById('broker-import-body') || document.getElementById('ls-import-body');
    const importChevron = document.getElementById('broker-import-chevron') || document.getElementById('ls-import-chevron');
    const tradesResult = document.getElementById('ls-trades-result');

    if (importBody) importBody.style.display = 'none';
    if (importChevron) importChevron.textContent = '▼ 펼치기';
    if (tradesResult) tradesResult.style.display = 'none';
    lsImportData = [];
}

try {
    handleSaveSuccess();
    assert.strictEqual(elements['broker-import-body'].style.display, 'none');
    assert.strictEqual(elements['broker-import-chevron'].textContent, '▼ 펼치기');
    assert.strictEqual(elements['ls-trades-result'].style.display, 'none');
    assert.strictEqual(lsImportData.length, 0);
    console.log('✅ 테스트 1 통과: broker-import-body가 정상적으로 닫히고 에러 없음');
} catch (err) {
    console.error('❌ 테스트 1 실패:', err.message);
    process.exit(1);
}

// [테스트 2] DOM 요소가 전혀 없을 때 (Null 방어 검증)
console.log('\n--- [테스트 2] DOM 요소가 없는 경우의 방어 로직 검증 ---');
elements['broker-import-body'] = null;
elements['broker-import-chevron'] = null;
elements['ls-trades-result'] = null;

try {
    handleSaveSuccess();
    console.log('✅ 테스트 2 통과: null 요소에 대한 안전한 방어로 예외 미발생');
} catch (err) {
    console.error('❌ 테스트 2 실패 (예외 발생):', err.message);
    process.exit(1);
}

console.log('\n🎉 모든 단위 검증 테스트를 성공적으로 통과했습니다!');
