import urllib.request
import json

url = "https://1drv.ms/u/c/791d7d6a6ea35b39/IQDEvRXrF2bTTptzCelhfWKBAefVNcuxd5KL1dNygdcbV3A?download=1"

try:
    print("Downloading...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req)
    content = response.read().decode('utf-8')
    data = json.loads(content)
    print("Success! Downloaded JSON.")
    print("Keys:", list(data.keys()) if isinstance(data, dict) else "List length: " + str(len(data)))
    if 'current_sheet' in data:
        print("Sheet:", data['current_sheet'])
except Exception as e:
    print("Failed to parse JSON:", str(e))
    # print first 100 chars to see what we got
    try:
        print("Content start:", content[:100])
    except:
        pass
