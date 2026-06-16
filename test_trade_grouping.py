import unittest
from copy import deepcopy

class TestTradeGrouping(unittest.TestCase):
    def test_grouping_logic(self):
        # 가상의 raw trades 데이터
        trades = [
            {
                "date": "2026-06-16", "ticker": "005930", "name": "삼성전자", "type": "매수",
                "qty": 10, "price": 80000, "amount": 800000, "investment": 80.0, "fee": 120, "ordno": "1"
            },
            {
                "date": "2026-06-16", "ticker": "005930", "name": "삼성전자", "type": "매수",
                "qty": 20, "price": 81000, "amount": 1620000, "investment": 162.0, "fee": 240, "ordno": "2"
            },
            {
                "date": "2026-06-16", "ticker": "005930", "name": "삼성전자", "type": "매도",
                "qty": 5, "price": 82000, "amount": 410000, "investment": 41.0, "fee": 60, "ordno": "3"
            },
            {
                "date": "2026-06-15", "ticker": "005930", "name": "삼성전자", "type": "매수",
                "qty": 15, "price": 79000, "amount": 1185000, "investment": 118.5, "fee": 180, "ordno": "4"
            }
        ]
        
        # ls_api.py 에 추가된 그룹화 로직 적용
        grouped_trades = {}
        for t in trades:
            key = (t["date"], t["ticker"], t["type"])
            if key not in grouped_trades:
                grouped_trades[key] = deepcopy(t)
            else:
                grouped_trades[key]["qty"] += t["qty"]
                grouped_trades[key]["price"] = max(grouped_trades[key]["price"], t["price"])
                grouped_trades[key]["amount"] += t["amount"]
                grouped_trades[key]["fee"] += t["fee"]
                grouped_trades[key]["investment"] = round(grouped_trades[key]["amount"] / 10000, 1)

        result_trades = list(grouped_trades.values())
        result_trades.sort(key=lambda x: (x["date"], x["name"], x["type"]))
        
        # 1. 2026-06-15 삼성전자 매수 (1건 그대로)
        self.assertEqual(result_trades[0]["qty"], 15)
        self.assertEqual(result_trades[0]["price"], 79000)
        
        # 2. 2026-06-16 삼성전자 매도 (1건 그대로)
        self.assertEqual(result_trades[1]["qty"], 5)
        self.assertEqual(result_trades[1]["price"], 82000)
        
        # 3. 2026-06-16 삼성전자 매수 (2건 병합됨)
        # 수량 합산 (10 + 20 = 30)
        self.assertEqual(result_trades[2]["qty"], 30)
        # 가격 최고가 기준 (80000, 81000 중 81000)
        self.assertEqual(result_trades[2]["price"], 81000)
        # 체결금액 합산 (800000 + 1620000 = 2420000)
        self.assertEqual(result_trades[2]["amount"], 2420000)
        # 투자금 재계산 (2420000 / 10000 = 242.0)
        self.assertEqual(result_trades[2]["investment"], 242.0)
        
        print("\n[테스트 통과] 그룹화 로직이 정상적으로 동작합니다!")
        for r in result_trades:
            print(f"  - {r['date']} | {r['name']} | {r['type']} | 수량: {r['qty']} | 최고가: {r['price']} | 체결금액: {r['amount']}")

if __name__ == '__main__':
    unittest.main()
