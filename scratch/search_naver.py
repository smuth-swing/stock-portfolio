import urllib.request
import json

client_id = "your_id"
client_secret = "your_secret"

# We can just use duckduckgo search via python
import urllib.request
import urllib.parse
import re

url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote("CDPCQ04700InBlock1")
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        # Extract snippets
        snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', html, re.IGNORECASE | re.DOTALL)
        for s in snippets:
            print(re.sub(r'<[^>]+>', '', s).strip())
            print('-'*40)
except Exception as e:
    print(e)