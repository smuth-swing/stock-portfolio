"""
OneDrive 엑셀 데이터 분석 서버
- OneDrive 로컬 동기화 폴더에서 엑셀 파일을 읽어 JSON API로 제공
- Flask 기반 REST API 서버
"""

import os
import sys
import glob
import json
import re
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import openpyxl
from openpyxl.styles import Font

# Windows 콘솔 CP949 인코딩 충돌 방지 - stdout/stderr를 UTF-8로 강제 설정
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
if sys.stderr.encoding != 'utf-8':
    sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf-8', buffering=1)


app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# 글로벌 OneDrive 경로 설정 (사용자 지정 경로 우선)
def find_target_onedrive_path():
    fixed_path = r"C:\Users\zerod\OneDrive"
    if os.path.isdir(fixed_path):
        return fixed_path
    
    # 자동 탐색 로직 (예비용)
    possible_paths = [
        os.path.expanduser("~/OneDrive"),
        os.path.expanduser("~/OneDrive - Personal"),
        os.path.expandvars(r"%USERPROFILE%\OneDrive"),
    ]
    for path in possible_paths:
        if path and os.path.isdir(path):
            return os.path.abspath(path)
    return None

ONEDRIVE_PATH = find_target_onedrive_path()

# ==================== 유틸리티 함수 (취소선 처리) ====================
def parse_strikethrough_text(text):
    """텍스트 내의 <del>태그 또는 ~~패턴을 파싱하여 CellRichText 객체로 변환"""
    if not isinstance(text, str) or not text:
        return text
    from openpyxl.cell.rich_text import CellRichText, TextBlock
    from openpyxl.styles import Font
    
    text = re.sub(r'<del>(.*?)</del>', r'~~\1~~', text)
    pattern = r'~~(.*?)~~'
    import re as regex
    parts = regex.split(pattern, text)
    
    if len(parts) == 1: return text
    
    rich_text = CellRichText()
    default_font = Font(name='맑은 고딕')
    strike_font = Font(name='맑은 고딕', strike=True)
    
    for i, part in enumerate(parts):
        if not part: continue
        if i % 2 == 0:
            rich_text.add(TextBlock(default_font, part))
        else:
            rich_text.add(TextBlock(strike_font, part))
    return rich_text

def extract_rich_text(cell):
    """엑셀 셀의 실제 취소선 서식을 감지하여 마크다운(~~) 형식으로 변환"""
    from openpyxl.cell.rich_text import CellRichText
    if not hasattr(cell, 'value') or cell.value is None: return ""
    if isinstance(cell.value, CellRichText):
        result = []
        for part in cell.value:
            text = part.text if hasattr(part, 'text') else str(part)
            if hasattr(part, 'font') and part.font and part.font.strike:
                result.append(f"~~{text}~~")
            else: result.append(text)
        return "".join(result)
    if cell.font and cell.font.strike: return f"~~{cell.value}~~"
    return str(cell.value)

@app.route('/')
def index():
    """메인 페이지 서빙"""
    return send_from_directory('.', 'index.html')

@app.route('/api/onedrive-status')
def onedrive_status():
    """OneDrive 연결 상태 확인"""
    if ONEDRIVE_PATH and os.path.isdir(ONEDRIVE_PATH):
        return jsonify({
            'connected': True,
            'path': ONEDRIVE_PATH,
            'message': f'OneDrive 연결됨: {ONEDRIVE_PATH}'
        })
    return jsonify({
        'connected': False,
        'path': None,
        'message': 'OneDrive 동기화 폴더를 찾을 수 없습니다. 경로를 직접 지정해주세요.'
    })

@app.route('/api/set-path', methods=['POST'])
def set_path():
    """OneDrive 경로 수동 설정"""
    global ONEDRIVE_PATH
    data = request.get_json()
    path = data.get('path', '')
    
    if os.path.isdir(path):
        ONEDRIVE_PATH = path
        return jsonify({'success': True, 'path': ONEDRIVE_PATH})
    return jsonify({'success': False, 'message': '유효하지 않은 경로입니다.'}), 400

@app.route('/api/files')
def list_excel_files():
    """OneDrive 내 엑셀 파일 목록 조회"""
    if not ONEDRIVE_PATH:
        return jsonify({'error': 'OneDrive 경로가 설정되지 않았습니다.'}), 400
    
    search_path = request.args.get('subdir', '')
    base_path = os.path.join(ONEDRIVE_PATH, search_path)
    
    if not os.path.isdir(base_path):
        return jsonify({'error': f'경로를 찾을 수 없습니다: {base_path}'}), 404
    
    files = []
    # 현재 폴더의 하위 디렉토리 목록
    directories = []
    
    try:
        for item in os.listdir(base_path):
            full_path = os.path.join(base_path, item)
            rel_path = os.path.relpath(full_path, ONEDRIVE_PATH)
            
            if os.path.isdir(full_path):
                # 숨김 폴더 제외
                if not item.startswith('.'):
                    directories.append({
                        'name': item,
                        'path': rel_path.replace('\\', '/')
                    })
            elif item.lower().endswith(('.xlsx', '.xls', '.xlsm')):
                stat = os.stat(full_path)
                files.append({
                    'name': item,
                    'path': rel_path.replace('\\', '/'),
                    'size': stat.st_size,
                    'modified': stat.st_mtime,
                    'full_path': full_path
                })
    except PermissionError:
        return jsonify({'error': '해당 폴더에 대한 접근 권한이 없습니다.'}), 403
    
    return jsonify({
        'current_dir': search_path or '/',
        'directories': sorted(directories, key=lambda x: x['name']),
        'files': sorted(files, key=lambda x: x['name'])
    })

@app.route('/api/read-excel')
def read_excel():
    """엑셀 파일 데이터 읽기"""
    if not ONEDRIVE_PATH:
        return jsonify({'error': 'OneDrive 경로가 설정되지 않았습니다.'}), 400
    
    file_path = request.args.get('file', '')
    sheet_name = request.args.get('sheet', None)
    
    full_path = os.path.join(ONEDRIVE_PATH, file_path)
    
    if not os.path.isfile(full_path):
        return jsonify({'error': f'파일을 찾을 수 없습니다: {file_path}'}), 404
    
    try:
        import io
        # 파일 잠금(Lock)을 방지하기 위해 메모리로 먼저 읽어오기
        with open(full_path, 'rb') as f:
            file_data = f.read()
            
        # 시트 목록 가져오기
        xl = pd.ExcelFile(io.BytesIO(file_data), engine='openpyxl')
        sheet_names = xl.sheet_names
        
        # 특정 시트 또는 첫 번째 시트 읽기
        target_sheet = sheet_name if sheet_name else sheet_names[0]
        df = pd.read_excel(xl, sheet_name=target_sheet)
        
        # NaN 값 처리
        df = df.fillna('')

        # --- 실적 시트 특수 처리 (헤더 자동 탐색) ---
        header_row_idx = 0
        if "실적" in target_sheet and not df.empty:
            # 첫 10행 내에서 '연도' 또는 '수익율' 키워드 찾기
            found_header = False
            for i in range(min(10, len(df))):
                row_vals = [str(x).strip() for x in df.iloc[i].values]
                if any("연도" in val or "수익율" in val for val in row_vals):
                    header_row_idx = i
                    # 현재 행을 컬럼명으로 승격
                    new_cols = []
                    for j, val in enumerate(row_vals):
                        if val and val != 'nan':
                            new_cols.append(val)
                        else:
                            new_cols.append(f"Unnamed: {j}")
                    df.columns = new_cols
                    df = df.iloc[i+1:].reset_index(drop=True)
                    found_header = True
                    break
            
            # 만약 못 찾았더라도 '연도' 컬럼이 B열(1번 인덱스)에 있는 경우가 많으므로 보정
            if not found_header and len(df.columns) > 1:
                # B4가 15년이면 B3가 헤더일 가능성 높음 (pandas 0-indexed 기준 Row 2)
                pass

        # 숫자형 컬럼 감지 (강제 변환 시도 포함)
        for col in df.columns:
            if '연도' in str(col): continue 
            try:
                temp_numeric = pd.to_numeric(df[col].replace('', pd.NA), errors='coerce')
                if temp_numeric.notna().any():
                    if temp_numeric.notna().sum() / len(df) > 0.2: # 기준 완화
                        df[col] = temp_numeric.fillna(0)
            except:
                pass

        numeric_columns = df.select_dtypes(include=['number']).columns.tolist()
        
        # 기본 통계 계산
        stats = {}
        for col in numeric_columns:
            col_data = df[col].replace('', pd.NA).dropna()
            if len(col_data) > 0:
                stats[col] = {
                    'mean': round(float(col_data.mean()), 2),
                    'sum': round(float(col_data.sum()), 2),
                    'min': round(float(col_data.min()), 2),
                    'max': round(float(col_data.max()), 2),
                    'count': int(col_data.count()),
                    'std': round(float(col_data.std()), 2) if len(col_data) > 1 else 0
                }
        
        # 데이터를 JSON 직렬화 가능한 형태로 변환
        columns = [str(c) for c in df.columns.tolist()]
        
        # 탐구생활/실적 시트인 경우 서식 데이터(취소선 등)를 위해 openpyxl로 재확인
        is_special = any(k in target_sheet for k in ["탐구", "실적"])
        if is_special:
            # openpyxl 워크북 로드
            wb_format = openpyxl.load_workbook(io.BytesIO(file_data), data_only=True)
            ws_format = wb_format[target_sheet]
            
            data = []
            # openpyxl은 1-based index이므로 pandas 인덱스 기반 보정
            # pandas df.iloc[header_row_idx]는 원본 엑셀의 row=header_row_idx+2 (기본 헤더가 1행일 때)
            # 하지만 df를 처음 읽을 때 이미 Row 1이 헤더로 쓰였으므로:
            # Row 1 (Header), df.iloc[0] = Row 2, df.iloc[1] = Row 3 ...
            # 따라서 header_row_idx일 때 엑셀 행은 header_row_idx + 2
            start_row = header_row_idx + 3 if "실적" in target_sheet else 2
            
            for r_idx in range(start_row, ws_format.max_row + 1):
                row_data = {}
                for c_idx, col_name in enumerate(columns, start=1):
                    cell = ws_format.cell(row=r_idx, column=c_idx)
                    row_data[col_name] = extract_rich_text(cell)
                data.append(row_data)
        else:
            data = []
            for _, row in df.iterrows():
                row_data = {}
                for i, col in enumerate(df.columns):
                    val = row[col]
                    col_name = columns[i]
                    if pd.isna(val): row_data[col_name] = ''
                    elif isinstance(val, (int, float)): row_data[col_name] = val
                    else: row_data[col_name] = str(val)
                data.append(row_data)
        
        # 파일 수정 시간 가져오기
        file_stat = os.stat(full_path)
        last_modified = file_stat.st_mtime

        return jsonify({
            'file_name': os.path.basename(file_path),
            'last_modified': last_modified,
            'sheet_names': sheet_names,
            'current_sheet': target_sheet,
            'columns': columns,
            'numeric_columns': [str(c) for c in numeric_columns],
            'data': data,
            'row_count': len(data),
            'stats': stats
        })
    
    except Exception as e:
        return jsonify({'error': f'엑셀 파일 읽기 오류: {str(e)}'}), 500

@app.route('/api/analyze')
def analyze_data():
    """엑셀 데이터 심층 분석"""
    if not ONEDRIVE_PATH:
        return jsonify({'error': 'OneDrive 경로가 설정되지 않았습니다.'}), 400
    
    file_path = request.args.get('file', '')
    sheet_name = request.args.get('sheet', None)
    
    full_path = os.path.join(ONEDRIVE_PATH, file_path)
    
    if not os.path.isfile(full_path):
        return jsonify({'error': f'파일을 찾을 수 없습니다: {file_path}'}), 404
    
    try:
        import io
        # 파일 잠금(Lock)을 방지하기 위해 메모리로 먼저 읽어오기
        with open(full_path, 'rb') as f:
            file_data = f.read()
            
        df = pd.read_excel(io.BytesIO(file_data), sheet_name=sheet_name, engine='openpyxl')
        df = df.fillna('')
        
        # 컬럼 타입 분석
        column_analysis = []
        for col in df.columns:
            col_data = df[col].replace('', pd.NA).dropna()
            col_info = {
                'name': str(col),
                'total': len(df),
                'non_empty': int(col_data.count()) if hasattr(col_data, 'count') else len(col_data),
                'unique': int(df[col].nunique()),
            }
            
            # 숫자형인지 확인
            numeric_data = pd.to_numeric(col_data, errors='coerce').dropna()
            if len(numeric_data) > 0 and len(numeric_data) / max(len(col_data), 1) > 0.5:
                col_info['type'] = 'numeric'
                col_info['stats'] = {
                    'mean': round(float(numeric_data.mean()), 2),
                    'median': round(float(numeric_data.median()), 2),
                    'sum': round(float(numeric_data.sum()), 2),
                    'min': round(float(numeric_data.min()), 2),
                    'max': round(float(numeric_data.max()), 2),
                    'std': round(float(numeric_data.std()), 2) if len(numeric_data) > 1 else 0,
                }
            else:
                col_info['type'] = 'text'
                # 상위 빈도 값
                value_counts = df[col].value_counts().head(10)
                col_info['top_values'] = [
                    {'value': str(v), 'count': int(c)} 
                    for v, c in value_counts.items() if str(v).strip()
                ]
            
            column_analysis.append(col_info)
        
        return jsonify({
            'file_name': os.path.basename(file_path),
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'column_analysis': column_analysis
        })
    
    except Exception as e:
        return jsonify({'error': f'분석 오류: {str(e)}'}), 500


@app.route('/api/save-journal', methods=['POST'])
def save_journal():
    """매매일지 데이터 추가 저장"""
    if not ONEDRIVE_PATH:
        return jsonify({'error': 'OneDrive 경로가 설정되지 않았습니다.'}), 400
    
    data = request.get_json()
    file_path = data.get('file', '')
    sheet_name = data.get('sheet', '매매일지')
    row_values = data.get('row', [])  # [날짜, 종목, 수량, 단가, 매매종류, 투자금]
    
    full_path = os.path.join(ONEDRIVE_PATH, file_path)
    
    if not os.path.isfile(full_path):
        return jsonify({'error': f'파일을 찾을 수 없습니다: {file_path}'}), 404
    
    try:
        from openpyxl.styles import Font, PatternFill

        # 포트폴리오 맵 업데이트에 사용할 스타일 정의
        yellow_fill = PatternFill(
            fill_type="solid",
            fgColor="FFFF00"   # 노란색
        )
        no_fill = PatternFill(fill_type=None)  # 배경색 없음(초기화용)

        # openpyxl을 사용하여 데이터 추가
        wb = openpyxl.load_workbook(full_path)
        try:
            if sheet_name not in wb.sheetnames:
                ws = wb.create_sheet(sheet_name)
            else:
                ws = wb[sheet_name]
            
            # 데이터 추가
            ws.append(row_values)
            
            # 마지막으로 추가된 행의 폰트 색상 설정
            last_row = ws.max_row
            trade_type_val = row_values[4] if len(row_values) > 4 else ""
            
            # 색상 결정 (매도: 빨간색, 매수: 검정색)
            font_color = "FF0000" if trade_type_val == "매도" else "000000"
            cell_font = Font(color=font_color)
            
            for col_idx in range(1, len(row_values) + 1):
                ws.cell(row=last_row, column=col_idx).font = cell_font
            
            # --- 포트폴리오 맵 절대값 동기화 ---
            # row_values: [날짜, 종목, 수량, 단가, 매매종류, 투자금]
            try:
                trade_stock = str(row_values[1]).strip() if len(row_values) > 1 else ""
                trade_stock_clean = trade_stock.replace(" ", "")
                
                # 투자금액 절대값 계산 (음수 포함 → abs 처리)
                raw_investment = float(row_values[5]) if len(row_values) > 5 else 0
                investment_amount = abs(raw_investment)
                target_marks = int(investment_amount // 100)
                
                print(f"[MAP] [{trade_stock}] invest={raw_investment} -> abs={investment_amount} -> marks={target_marks}")
                
                if trade_stock_clean and '포트폴리오 맵' in wb.sheetnames:
                    ws_map = wb['포트폴리오 맵']
                    
                    # 종목명이 일치하는 모든 행을 찾아서 처리
                    target_rows = []
                    for r in range(1, ws_map.max_row + 1):
                        cell_val = str(ws_map.cell(row=r, column=4).value or "").strip()
                        cell_val_clean = cell_val.replace(" ", "")
                        if cell_val_clean and (
                            trade_stock_clean in cell_val_clean
                            or cell_val_clean in trade_stock_clean
                        ):
                            target_rows.append(r)
                    
                    if target_rows:
                        for target_row in target_rows:
                            # 1단계: 마크 영역(E열~CV열, 5~100컬럼) 완전 초기화
                            #         - 값(1) 삭제, 노란색 배경 삭제
                            for c in range(5, 101):
                                cell = ws_map.cell(row=target_row, column=c)
                                cell.value = None
                                cell.fill = no_fill
                            
                            # 2단계: 절대값 기준 마크(1+노란색) 새로 반영
                            if target_marks > 0:
                                for i in range(target_marks):
                                    col_idx = 5 + i
                                    if col_idx <= 100:
                                        cell = ws_map.cell(row=target_row, column=col_idx)
                                        cell.value = 1
                                        cell.fill = yellow_fill
                        
                        # 3단계: 실제 반영된 마크 수 재검증 → 매매일지 투자금 보정
                        final_ones = sum(
                            1 for c in range(5, 101)
                            if ws_map.cell(row=target_rows[0], column=c).value == 1
                        )
                        ws.cell(row=last_row, column=6).value = final_ones * 100
                        print(f"[OK] [{trade_stock}] sync done: rows={target_rows}, marks={final_ones} ({final_ones * 100} man)")
                    else:
                        print(f"[WARN] [{trade_stock}] stock not found in portfolio map.")
                else:
                    print(f"[WARN] portfolio map sheet not found or stock name is empty.")
                    
            except Exception as inner_e:
                import traceback
                print(f"[ERROR] portfolio map update failed: {inner_e}")
                print(traceback.format_exc())
            
            # 최종 저장 (매매일지 + 포트폴리오 맵 모두 반영)
            wb.save(full_path)
                
        finally:
            # 오류가 발생하더라도 확실하게 파일을 닫아 잠금 해제
            wb.close()
        
        return jsonify({'success': True, 'message': '성공적으로 저장되었습니다.'})
    
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': f'저장 오류: {str(e)}'}), 500


@app.route('/api/update-row', methods=['POST'])
def update_row():
    if not ONEDRIVE_PATH:
        return jsonify({'error': 'OneDrive 경로가 설정되지 않았습니다.'}), 400

    data = request.get_json()
    file_path = data.get('file', '')
    sheet_name = data.get('sheet')
    row_index = int(data.get('rowIndex', 0))
    values = data.get('values', [])

    if not sheet_name:
        return jsonify({'error': 'sheet 값이 필요합니다.'}), 400

    full_path = os.path.join(ONEDRIVE_PATH, file_path)
    if not os.path.isfile(full_path):
        return jsonify({'error': f'파일을 찾을 수 없습니다: {file_path}'}), 404

    try:
        from openpyxl.styles import Alignment
        wb = openpyxl.load_workbook(full_path)
        if sheet_name not in wb.sheetnames:
            return jsonify({'error': f'시트를 찾을 수 없습니다: {sheet_name}'}), 404

        ws = wb[sheet_name]
        target_row = row_index + 2
        for col_idx, value in enumerate(values, start=1):
            cell = ws.cell(row=target_row, column=col_idx)
            # 취소선 처리
            processed_value = parse_strikethrough_text(value)
            cell.value = processed_value
            
            # 줄바꿈(\n)이 포함된 셀은 엑셀에서도 표시되도록 wrap_text 설정
            if isinstance(value, str) and '\n' in value:
                cell.alignment = Alignment(wrap_text=True)

        wb.save(full_path)
        wb.close()
        return jsonify({'success': True, 'message': '행이 업데이트되었습니다.'})
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': f'업데이트 오류: {str(e)}'}), 500


if __name__ == '__main__':
    print("=" * 60)
    print("  Stock Portfolio Analysis Server")
    print("=" * 60)
    if ONEDRIVE_PATH:
        print(f"  OneDrive Path: {os.path.normpath(ONEDRIVE_PATH)}")
    else:
        print("  OneDrive path not detected.")
        print("  Please set the path in the Web UI.")
    print(f"  Server Address: http://localhost:5000")
    print("=" * 60)
    
    try:
        # 배포 시에는 debug=False 권장
        app.run(debug=False, port=5000, host='0.0.0.0')
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)
