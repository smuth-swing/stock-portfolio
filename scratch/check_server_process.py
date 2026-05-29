import psutil
for p in psutil.process_iter(['pid', 'name', 'cmdline']):
    if 'python' in p.info['name'].lower():
        cmd = ' '.join(p.info['cmdline']) if p.info['cmdline'] else ''
        if 'server.py' in cmd or 'flask' in cmd:
            print(f"PID: {p.info['pid']} - {cmd}")