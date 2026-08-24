/**
 * 엑셀 JSON 컬럼명 해석 헬퍼
 *
 * 엑셀 시트 헤더가 바뀌면서 JSON 컬럼명이 두 가지 포맷으로 존재한다:
 * - 신규 포맷: 실제 이름 컬럼 (Date, 종목, 수량, 가격, 매매유형 / 전략, 분류, 종목, 숫자 금액 헤더)
 * - 구 포맷:   Unnamed: 0..N (첫 데이터 행에 헤더 값이 포함)
 *
 * 두 포맷을 모두 지원하기 위해 '명명 컬럼 우선 + Unnamed 폴백' 방식을 사용한다.
 */

/** 행에서 지정한 후보 컬럼명 중 값이 존재하는 첫 번째 값을 반환 */
export const getField = (row: any, names: string[]): any => {
  if (!row) return '';
  for (const n of names) {
    const v = row[n];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
};

/** 매매일지 컬럼명 (신규 명명 우선, 구 Unnamed 폴백) */
export const JOURNAL_FIELDS = {
  date:   ['Date', 'Unnamed: 0'],
  stock:  ['종목', 'Unnamed: 1'],
  qty:    ['수량', 'Unnamed: 2'],
  price:  ['가격', '단가', 'Unnamed: 3'],
  type:   ['매매유형', '매매종류', 'Unnamed: 4'],
  amount: ['하고 싶은 말', '투자금', 'Unnamed: 5'],
};

/** 매매일지 데이터 행 반환 (구 포맷의 헤더 행 자동 제거) */
export const getJournalDataRows = (data: any): any[] => {
  const rows: any[] = (data && data.data) || [];
  if (rows.length > 0) {
    const firstStock = String(getField(rows[0], JOURNAL_FIELDS.stock)).trim();
    if (firstStock === '종목' || firstStock === 'stock') {
      return rows.slice(1);
    }
  }
  return rows;
};

export interface PortfolioMapInfo {
  stockCol: string | null;
  strategyCol: string | null;
  sectorCol: string | null;
  amountCols: string[];
  dataRows: any[];
}

/**
 * 포트폴리오 맵 컬럼/행 해석
 * - 신규 포맷: '종목'/'전략'/'분류' + 숫자 금액 헤더(100, 200, ...)
 * - 구 포맷:   Unnamed: 0..N + 첫 데이터 행에 헤더 값 포함
 */
export const getPortfolioMapInfo = (data: any): PortfolioMapInfo => {
  const cols: string[] = (data && data.columns) || [];

  const pick = (names: string[], fallback: string): string | null => {
    for (const n of names) {
      if (cols.includes(n)) return n;
    }
    return cols.includes(fallback) ? fallback : null;
  };

  const stockCol = pick(['종목'], 'Unnamed: 3');
  const strategyCol = pick(['전략'], 'Unnamed: 1');
  const sectorCol = pick(['분류'], 'Unnamed: 2');

  // 금액 컬럼: 숫자 헤더(100, 200, ...) 우선, Unnamed: 4 이상도 허용
  const amountCols = cols.filter((c: string) => {
    if (c.startsWith('Unnamed:')) {
      return parseInt(c.split(':')[1], 10) >= 4;
    }
    const n = parseFloat(c);
    return !isNaN(n) && isFinite(n);
  });

  let dataRows: any[] = (data && data.data) || [];
  if (dataRows.length > 0 && stockCol) {
    const firstStock = String(dataRows[0][stockCol] || '').trim();
    if (firstStock === '종목' || firstStock === 'stock') {
      dataRows = dataRows.slice(1);
    }
  }

  return { stockCol, strategyCol, sectorCol, amountCols, dataRows };
};
