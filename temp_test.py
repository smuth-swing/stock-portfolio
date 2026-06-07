import urllib.request
import urllib.parse

try:
    url = "http://127.0.0.1:5000/api/ls/moving-averages?name=" + urllib.parse.quote("LIG디펜스앤에어로스페이스")
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
