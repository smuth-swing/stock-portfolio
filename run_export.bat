@echo off
chcp 65001 > nul
cd /d "C:\Users\zerod\.antigravity\주식 포트폴리오 관리"
echo [%date% %time%] JSON 내보내기 시작 >> export_log.txt
python export_to_json.py >> export_log.txt 2>&1
echo [%date% %time%] 완료 >> export_log.txt
