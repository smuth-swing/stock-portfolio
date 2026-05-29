import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

codes = ['003160', '378340', '310210', '445290']
for code in codes:
    url = f"https://m.stock.naver.com/api/stock/{code}/basic"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=ctx) as res:
            data = json.loads(res.read().decode('utf-8'))
            print(f"{code}: {data['stockName']}")
    except Exception as e:
        print(f"{code}: error {e}")