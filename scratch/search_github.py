import urllib.request
import json

url = 'https://api.github.com/search/code?q=CDPCQ04700+language:python'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        for item in data.get('items', [])[:3]:
            print(item['html_url'])
            # Fetch the raw content
            raw_url = item['raw_url']
            try:
                with urllib.request.urlopen(urllib.request.Request(raw_url, headers={'User-Agent': 'Mozilla/5.0'})) as f:
                    content = f.read().decode('utf-8')
                    # Find CDPCQ04700 block
                    lines = content.split('\n')
                    for i, line in enumerate(lines):
                        if 'CDPCQ04700' in line:
                            start = max(0, i-5)
                            end = min(len(lines), i+15)
                            print('\n'.join(lines[start:end]))
                            print('---')
            except Exception as e:
                print(e)
except Exception as e:
    print(e)