import subprocess, sys

task_name = "StockPortfolioHealthCheck"
vbs_file  = r'C:\Users\zerod\.antigravity\주식 포트폴리오 관리\run_health_check_hidden.vbs'
tr        = f'wscript.exe "{vbs_file}"'

# 기존 삭제
subprocess.run(['schtasks', '/delete', '/tn', task_name, '/f'],
               capture_output=True)

# 등록
result = subprocess.run(
    ['schtasks', '/create',
     '/tn', task_name,
     '/tr', tr,
     '/sc', 'MINUTE',
     '/mo', '70',
     '/f'],
    capture_output=True, text=True, encoding='cp949'
)
print('STDOUT:', result.stdout)
print('STDERR:', result.stderr)
print('RC:', result.returncode)