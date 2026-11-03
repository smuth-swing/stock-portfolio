/**
 * 탐구생활 신규 종목 및 동기화 큐 복원 로직 단위 테스트
 * - 핸드폰에서 신규 종목(예: 현대해상) 입력 후 서버 새로고침이 실행되어도 목록에 보존되는지 검증
 */

const assert = require('assert');
const fs = require('fs');

// useDataStore.ts 파일에서 applyQueueToData 함수 추출하여 TS 타입 어노테이션 제거 후 평가
const code = fs.readFileSync('StockPortfolioApp/src/store/useDataStore.ts', 'utf-8');
const startIdx = code.indexOf('const applyQueueToData =');
const endIdx = code.indexOf('export const useDataStore', startIdx);
let rawSection = code.slice(startIdx, endIdx);
const lastSemi = rawSection.lastIndexOf('};');
let fnBody = rawSection.slice(0, lastSemi + 1).replace('const applyQueueToData = ', '').trim();

// 간단한 TS 타입 제거
fnBody = fnBody
  .replace(/\(dataKey: string, dataObj: any, queue: any\[\]\)/g, '(dataKey, dataObj, queue)')
  .replace(/\(sheetName\?: string\)/g, '(sheetName)')
  .replace(/\(row: any\)/g, '(row)')
  .replace(/\(val: any, i: number\)/g, '(val, i)')
  .replace(/\(col: string\)/g, '(col)')
  .replace(/\(edit: any\)/g, '(edit)')
  .replace(/:\s*any\b/g, '')
  .replace(/:\s*string\b/g, '')
  .replace(/:\s*number\b/g, '');

const applyQueueToData = eval(`(${fnBody})`);

console.log('🧪 [테스트 시작] 탐구생활 동기화 큐 및 신규 종목 보존 검증');

// ── 테스트 1: 신규 종목(현대해상) 보존 테스트 ──
{
  const mockServerData = {
    columns: ['Unnamed: 0', '종목명', '질문', '모멘텀', '매수이유', '리스크', '대표/경영진', '매매 전략', '목표일', '목표가'],
    data: [
      { 'Unnamed: 0': 1, '종목명': 'SK하이닉스', _realIndex: 0 },
      { 'Unnamed: 0': 2, '종목명': '삼성전자', _realIndex: 1 },
    ],
  };

  const mockQueue = [
    {
      sheet: '탐구생활',
      rowIndex: 2,
      stockName: '현대해상',
      isNew: true,
      syncId: 'sync-test-123',
      values: [3, '현대해상', '질문내용', '모멘텀내용', '매수이유내용', '', '', '전략내용', '2026-12-31', '35000'],
      timestamp: new Date().toISOString(),
    },
  ];

  const result = applyQueueToData('investigation', mockServerData, mockQueue);

  assert.strictEqual(result.data.length, 3, '신규 종목이 추가되어 총 3건이어야 합니다.');
  assert.strictEqual(result.data[0]['종목명'], '현대해상', '맨 앞의 종목명이 현대해상이어야 합니다.');
  assert.strictEqual(result.data[0]['Unnamed: 1'], '현대해상', '하위호환 Unnamed: 1도 현대해상이어야 합니다.');
  assert.strictEqual(result.data[0]['모멘텀'], '모멘텀내용', '모멘텀 내용이 보존되어야 합니다.');
  assert.strictEqual(result.data[0]['목표가'], '35000', '목표가가 보존되어야 합니다.');
  assert.strictEqual(result.data[0]._isNew, true, '_isNew 플래그가 유지되어야 합니다.');

  console.log('  ✅ 테스트 1 통과: 신규 종목(현대해상)이 서버 새로고침 후에도 목록 맨 앞에 정상 보존됨');
}

// ── 테스트 2: PC 전송 후 서버 데이터에 이미 반영된 경우 중복 방지 테스트 ──
{
  const mockServerData = {
    columns: ['Unnamed: 0', '종목명', '질문', '모멘텀', '매수이유', '리스크', '대표/경영진', '매매 전략', '목표일', '목표가'],
    data: [
      { 'Unnamed: 0': 1, '종목명': 'SK하이닉스', _realIndex: 0 },
      { 'Unnamed: 0': 2, '종목명': '삼성전자', _realIndex: 1 },
      { 'Unnamed: 0': 3, '종목명': '현대해상', '모멘텀': '서버값', _realIndex: 2 },
    ],
  };

  const mockQueue = [
    {
      sheet: '탐구생활',
      rowIndex: 2,
      stockName: '현대해상',
      isNew: true,
      syncId: 'sync-test-123',
      values: [3, '현대해상', '질문내용', '최신모멘텀', '매수이유내용', '', '', '전략내용', '2026-12-31', '35000'],
      timestamp: new Date().toISOString(),
    },
  ];

  const result = applyQueueToData('investigation', mockServerData, mockQueue);

  assert.strictEqual(result.data.length, 3, '서버에 이미 존재할 경우 중복 추가되지 않고 3건이어야 합니다.');
  const hde = result.data.find(r => r['종목명'] === '현대해상');
  assert.strictEqual(hde['모멘텀'], '최신모멘텀', '큐에 있던 최신 수정 내용으로 갱신되어야 합니다.');

  console.log('  ✅ 테스트 2 통과: PC 서버 반영 후 중복 추가 방지 및 최신값 오버레이 정상 동작');
}

// ── 테스트 3: 기존 종목 수정 오버레이 테스트 ──
{
  const mockServerData = {
    columns: ['Unnamed: 0', '종목명', '질문', '모멘텀', '매수이유', '리스크', '대표/경영진', '매매 전략', '목표일', '목표가'],
    data: [
      { 'Unnamed: 0': 1, '종목명': 'SK하이닉스', '매수이유': '옛날이유', _realIndex: 0 },
      { 'Unnamed: 0': 2, '종목명': '삼성전자', '매수이유': '옛날이유', _realIndex: 1 },
    ],
  };

  const mockQueue = [
    {
      sheet: '탐구생활',
      rowIndex: 1,
      stockName: '삼성전자',
      isNew: false,
      syncId: 'sync-edit-456',
      values: [2, '삼성전자', '새질문', '', '수정된 매수이유', '', '', '', '', ''],
      timestamp: new Date().toISOString(),
    },
  ];

  const result = applyQueueToData('investigation', mockServerData, mockQueue);

  assert.strictEqual(result.data.length, 2, '행 수는 2건이어야 합니다.');
  assert.strictEqual(result.data[1]['매수이유'], '수정된 매수이유', '삼성전자의 매수이유가 정상 수정되어야 합니다.');
  assert.strictEqual(result.data[0]['매수이유'], '옛날이유', 'SK하이닉스는 변경되지 않아야 합니다.');

  console.log('  ✅ 테스트 3 통과: 기존 종목(삼성전자) 수정 내역이 서버 새로고침 후에도 안전하게 유지됨');
}

// ── 테스트 4: 빈 큐 및 데이터 없을 때 안정성 테스트 ──
{
  const mockServerData = { columns: ['종목명'], data: [{ '종목명': 'LG화학' }] };
  const emptyQueueResult = applyQueueToData('investigation', mockServerData, []);
  assert.strictEqual(emptyQueueResult.data.length, 1);

  const nullDataResult = applyQueueToData('investigation', null, []);
  assert.strictEqual(nullDataResult, null);

  console.log('  ✅ 테스트 4 통과: 빈 큐 및 엣지 케이스 안정성 확인');
}

console.log('\n🎉 [모든 검증 테스트 통과] 큐 복원 및 신규 종목 보존 로직이 완벽하게 동작합니다.');
