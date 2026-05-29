"""LS증권 API 최종 테스트"""
import sys
sys.path.insert(0, '.')
from ls_api import fetch_trade_history

print("=== 거래내역 조회 (2026-01-01 ~ 오늘) ===")
try:
    trades = fetch_trade_history(from_date="20260101", to_date="20260528")
    print(f"체결 건수: {len(trades)}건")
    for t in trades:
        print(f"  {t['date']} | {t['name']}({t['ticker']}) | {t['type']} | {t['qty']}주 | {t['price']:,}원 | 투자금 {t['investment']}만원")
except Exception as e:
    import traceback
    traceback.print_exc()
