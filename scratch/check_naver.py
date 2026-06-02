import urllib.request
import json

url = 'https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:328130'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode('utf-8'))
    item = data['result']['areas'][0]['datas'][0]
    print(f"Lunit (328130) Naver Finance: {item['nm']}, Price: {item['nv']}")
except Exception as e:
    print(e)
