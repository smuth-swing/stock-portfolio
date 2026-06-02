"""
OneDrive ?‘ì? ?°ì´??ë¶„ì„ ?œë²„
- OneDrive ë¡œì»¬ ?™ê¸°???´ë”?ì„œ ?‘ì? ?Œì¼???½ì–´ JSON APIë¡??œê³µ
- Flask ê¸°ë°˜ REST API ?œë²„
"""

import os
import sys
import json
import re
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import openpyxl
import subprocess
import threading
from openpyxl.styles import Font

# Windows ì½˜ì†” CP949 ?¸ì½”??ì¶©ëŒ ë°©ì? - stdout/stderrë¥?UTF-8ë¡?ê°•ì œ ?¤ì •
if sys.stdout.encoding != 'utf-8':
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
if sys.stderr.encoding != 'utf-8':
    sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf-8', buffering=1)


app = Flask(__name__, static_folder='.', static_url_path='')
# ëª¨ë“  ê²½ë¡œ?€ ?¤ë¦¬ì§„ì— ?€??CORS ?ˆìš© (ëª¨ë°”?????‘ì†??
CORS(app, resources={r"/api/*": {"origins": "*"}})

# API ?‘ë‹µ gzip ?•ì¶• (?€?©ëŸ‰ JSON ?„ì†¡ ìµœì ??- ??70~80% ?¬ê¸° ê°ì†Œ)
try:
    from flask_compress import Compress
    compress = Compress()
    app.config['COMPRESS_MIMETYPES'] = [
        'application/json',
        'text/html',
        'text/css',
        'application/javascript',
    ]
    app.config['COMPRESS_LEVEL'] = 6      # ?•ì¶• ?ˆë²¨ (1~9, 6???ë„/?¬ê¸° ê· í˜•)
    app.config['COMPRESS_MIN_SIZE'] = 500 # 500ë°”ì´???´ìƒë§??•ì¶•
    compress.init_app(app)
    print("[COMPRESS] gzip ?•ì¶• ?œì„±?”ë¨")
except ImportError:
    print("[COMPRESS] flask-compress ë¯¸ì„¤ì¹???pip install flask-compress ë¡??¤ì¹˜ ê°€??)


# ê¸€ë¡œë²Œ OneDrive ê²½ë¡œ ?¤ì • (?¬ìš©??ì§€??ê²½ë¡œ ?°ì„ )
def find_target_onedrive_path():
    fixed_path = r"C:\Users\zerod\OneDrive"
    if os.path.isdir(fixed_path):
        return fixed_path
    
    # ?ë™ ?ìƒ‰ ë¡œì§ (?ˆë¹„??
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

# ==================== ?ë™ ?™ê¸°???¸ë¦¬ê±?====================
def trigger_export():
    """?°ì´??ë³€ê²???export_to_json.pyë¥??¤í–‰?˜ì—¬ ?±ìš© JSON ê°±ì‹ """
    def run():
        try:
            print("[AUTO-SYNC] JSON ë³€???œì‘...")
            subprocess.run([sys.executable, "export_to_json.py"], check=True)
            print("[AUTO-SYNC] ??JSON ë³€???„ë£Œ!")
        except Exception as e:
            print(f"[AUTO-SYNC] ??ë³€???¤íŒ¨: {e}")

    # ?œë²„ ?‘ë‹µ??ë°©í•´?˜ì? ?Šë„ë¡?ë³„ë„ ?¤ë ˆ?œì—???¤í–‰
    threading.Thread(target=run).start()

# ==================== ? í‹¸ë¦¬í‹° ?¨ìˆ˜ (ì·¨ì†Œ??ì²˜ë¦¬) ====================
def parse_strikethrough_text(text):
    """?ìŠ¤???´ì˜ <del>?œê·¸ ?ëŠ” ~~?¨í„´???Œì‹±?˜ì—¬ CellRichText ê°ì²´ë¡?ë³€??""
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
    default_font = Font(name='ë§‘ì? ê³ ë”•')
    strike_font = Font(name='ë§‘ì? ê³ ë”•', strike=True)
    
    for i, part in enumerate(parts):
        if not part: continue
        if i % 2 == 0:
            rich_text.add(TextBlock(default_font, part))
        else:
            rich_text.add(TextBlock(strike_font, part))
    return rich_text

def extract_rich_text(cell):
    """?‘ì? ?€???¤ì œ ì·¨ì†Œ???œì‹??ê°ì??˜ì—¬ ë§ˆí¬?¤ìš´(~~) ?•ì‹?¼ë¡œ ë³€??""
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
    """ë©”ì¸ ?˜ì´ì§€ ?œë¹™"""
    return send_from_directory('.', 'index.html')



@app.route('/api/onedrive-status')
def onedrive_status():
    """OneDrive ?°ê²° ?íƒœ ?•ì¸"""
    if ONEDRIVE_PATH and os.path.isdir(ONEDRIVE_PATH):
        return jsonify({
            'connected': True,
            'path': ONEDRIVE_PATH,
            'message': f'OneDrive ?°ê²°?? {ONEDRIVE_PATH}'
        })
    return jsonify({
        'connected': False,
        'path': None,
        'message': 'OneDrive ?™ê¸°???´ë”ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤. ê²½ë¡œë¥?ì§ì ‘ ì§€?•í•´ì£¼ì„¸??'
    })

@app.route('/api/set-path', methods=['POST'])
def set_path():
    """OneDrive ê²½ë¡œ ?˜ë™ ?¤ì •"""
    global ONEDRIVE_PATH
    data = request.get_json()
    path = data.get('path', '')
    
    if os.path.isdir(path):
        ONEDRIVE_PATH = path
        return jsonify({'success': True, 'path': ONEDRIVE_PATH})
    return jsonify({'success': False, 'message': '? íš¨?˜ì? ?Šì? ê²½ë¡œ?…ë‹ˆ??'}), 400

@app.route('/api/files')
def list_excel_files():
    """OneDrive ???‘ì? ?Œì¼ ëª©ë¡ ì¡°íšŒ"""
    if not ONEDRIVE_PATH:
        return jsonify({'error': 'OneDrive ê²½ë¡œê°€ ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ??'}), 400
    
    search_path = request.args.get('subdir', '')
    base_path = os.path.join(ONEDRIVE_PATH, search_path)
    
    if not os.path.isdir(base_path):
        return jsonify({'error': f'ê²½ë¡œë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤: {base_path}'}), 404
    
    files = []
    # ?„ì¬ ?´ë”???˜ìœ„ ?”ë ‰? ë¦¬ ëª©ë¡
    directories = []
    
    try:
        for item in os.listdir(base_path):
            full_path = os.path.join(base_path, item)
            rel_path = os.path.relpath(full_path, ONEDRIVE_PATH)
            
            if os.path.isdir(full_path):
                # ?¨ê? ?´ë” ?œì™¸
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
        return jsonify({'error': '?´ë‹¹ ?´ë”???€???‘ê·¼ ê¶Œí•œ???†ìŠµ?ˆë‹¤.'}), 403
    
    return jsonify({
        'current_dir': search_path or '/',
        'directories': sorted(directories, key=lambda x: x['name']),
        'files': sorted(files, key=lambda x: x['name'])
    })

# ?Œì¼ ?Œì‹± ìºì‹œ
EXCEL_CACHE = {}

@app.route('/api/read-excel')
def read_excel():
    """?‘ì? ?Œì¼ ?°ì´???½ê¸°"""
    if not ONEDRIVE_PATH:
        return jsonify({'error': 'OneDrive ê²½ë¡œê°€ ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ??'}), 400
    
    file_path = request.args.get('file', '')
    sheet_name = request.args.get('sheet', None)
    
    full_path = os.path.join(ONEDRIVE_PATH, file_path)
    
    if not os.path.isfile(full_path):
        return jsonify({'error': f'?Œì¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤: {file_path}'}), 404
    
    try:
        import io
        
        # ìºì‹œ ?•ì¸ (?˜ì • ?œê°„??ê°™ìœ¼ë©?ìºì‹œ ë°˜í™˜)
        file_stat = os.stat(full_path)
        last_modified = file_stat.st_mtime
        
        cache_key = f"{full_path}_{sheet_name}_{last_modified}"
        if cache_key in EXCEL_CACHE:
            return jsonify(EXCEL_CACHE[cache_key])
            
        # ?Œì¼ ? ê¸ˆ(Lock)??ë°©ì??˜ê¸° ?„í•´ ë©”ëª¨ë¦¬ë¡œ ë¨¼ì? ?½ì–´?¤ê¸°
        with open(full_path, 'rb') as f:
            file_data = f.read()
            
        # ?œíŠ¸ ëª©ë¡ ê°€?¸ì˜¤ê¸?
        xl = pd.ExcelFile(io.BytesIO(file_data), engine='openpyxl')
        sheet_names = xl.sheet_names
        
        # ?¹ì • ?œíŠ¸ ?ëŠ” ì²?ë²ˆì§¸ ?œíŠ¸ ?½ê¸°
        target_sheet = sheet_name if sheet_name else sheet_names[0]
        df = pd.read_excel(xl, sheet_name=target_sheet)
        
        # NaN ê°?ì²˜ë¦¬
        df = df.fillna('')

        # --- ?¤ì  ?œíŠ¸ ?¹ìˆ˜ ì²˜ë¦¬ (?¤ë” ?ë™ ?ìƒ‰) ---
        header_row_idx = 0
        if "?¤ì " in target_sheet and not df.empty:
            # ì²?10???´ì—??'?°ë„' ?ëŠ” '?˜ìµ?? ?¤ì›Œ??ì°¾ê¸°
            found_header = False
            for i in range(min(10, len(df))):
                row_vals = [str(x).strip() for x in df.iloc[i].values]
                if any("?°ë„" in val or "?˜ìµ?? in val for val in row_vals):
                    header_row_idx = i
                    # ?„ì¬ ?‰ì„ ì»¬ëŸ¼ëª…ìœ¼ë¡??¹ê²©
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
            
            # ë§Œì•½ ëª?ì°¾ì•˜?”ë¼??'?°ë„' ì»¬ëŸ¼??B??1ë²??¸ë±?????ˆëŠ” ê²½ìš°ê°€ ë§ìœ¼ë¯€ë¡?ë³´ì •
            if not found_header and len(df.columns) > 1:
                # B4ê°€ 15?„ì´ë©?B3ê°€ ?¤ë”??ê°€?¥ì„± ?’ìŒ (pandas 0-indexed ê¸°ì? Row 2)
                pass

        # ?«ì??ì»¬ëŸ¼ ê°ì? (ê°•ì œ ë³€???œë„ ?¬í•¨)
        for col in df.columns:
            if '?°ë„' in str(col): continue 
            try:
                temp_numeric = pd.to_numeric(df[col].replace('', pd.NA), errors='coerce')
                if temp_numeric.notna().any():
                    if temp_numeric.notna().sum() / len(df) > 0.2: # ê¸°ì? ?„í™”
                        df[col] = temp_numeric.fillna(0)
            except:
                pass

        numeric_columns = df.select_dtypes(include=['number']).columns.tolist()
        
        # ê¸°ë³¸ ?µê³„ ê³„ì‚°
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
        
        # ?°ì´?°ë? JSON ì§ë ¬??ê°€?¥í•œ ?•íƒœë¡?ë³€??
        columns = [str(c) for c in df.columns.tolist()]
        
        # ?êµ¬?í™œ/?¤ì  ?œíŠ¸??ê²½ìš° ?œì‹ ?°ì´??ì·¨ì†Œ????ë¥??„í•´ openpyxlë¡??¬í™•??
        is_special = any(k in target_sheet for k in ["?êµ¬", "?¤ì "])
        if is_special:
            # openpyxl ?Œí¬ë¶?ë¡œë“œ
            wb_format = openpyxl.load_workbook(io.BytesIO(file_data), data_only=True)
            ws_format = wb_format[target_sheet]
            
            data = []
            # openpyxl?€ 1-based index?´ë?ë¡?pandas ?¸ë±??ê¸°ë°˜ ë³´ì •
            # pandas df.iloc[header_row_idx]???ë³¸ ?‘ì???row=header_row_idx+2 (ê¸°ë³¸ ?¤ë”ê°€ 1?‰ì¼ ??
            # ?˜ì?ë§?dfë¥?ì²˜ìŒ ?½ì„ ???´ë? Row 1???¤ë”ë¡??°ì??¼ë?ë¡?
            # Row 1 (Header), df.iloc[0] = Row 2, df.iloc[1] = Row 3 ...
            # ?°ë¼??header_row_idx?????‘ì? ?‰ì? header_row_idx + 2
            start_row = header_row_idx + 3 if "?¤ì " in target_sheet else 2
            
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
        
        # ?Œì¼ ?˜ì • ?œê°„ ê°€?¸ì˜¤ê¸?
        file_stat = os.stat(full_path)
        last_modified = file_stat.st_mtime

        response_data = {
            'file_name': os.path.basename(file_path),
            'last_modified': last_modified,
            'sheet_names': sheet_names,
            'current_sheet': target_sheet,
            'columns': columns,
            'numeric_columns': [str(c) for c in numeric_columns],
            'data': data,
            'row_count': len(data),
            'stats': stats
        }
        
        # ìºì‹œ ?€??(ë©”ëª¨ë¦??„ìˆ˜ ë°©ì?ë¥??„í•´ ì´ˆê¸°?????€??
        EXCEL_CACHE.clear()
        EXCEL_CACHE[cache_key] = response_data

        return jsonify(response_data)
    
    except Exception as e:
        return jsonify({'error': f'?‘ì? ?Œì¼ ?½ê¸° ?¤ë¥˜: {str(e)}'}), 500

@app.route('/api/analyze')
def analyze_data():
    """?‘ì? ?°ì´???¬ì¸µ ë¶„ì„"""
    if not ONEDRIVE_PATH:
        return jsonify({'error': 'OneDrive ê²½ë¡œê°€ ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ??'}), 400
    
    file_path = request.args.get('file', '')
    sheet_name = request.args.get('sheet', None)
    
    full_path = os.path.join(ONEDRIVE_PATH, file_path)
    
    if not os.path.isfile(full_path):
        return jsonify({'error': f'?Œì¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤: {file_path}'}), 404
    
    try:
        import io
        # ?Œì¼ ? ê¸ˆ(Lock)??ë°©ì??˜ê¸° ?„í•´ ë©”ëª¨ë¦¬ë¡œ ë¨¼ì? ?½ì–´?¤ê¸°
        with open(full_path, 'rb') as f:
            file_data = f.read()
            
        df = pd.read_excel(io.BytesIO(file_data), sheet_name=sheet_name, engine='openpyxl')
        df = df.fillna('')
        
        # ì»¬ëŸ¼ ?€??ë¶„ì„
        column_analysis = []
        for col in df.columns:
            col_data = df[col].replace('', pd.NA).dropna()
            col_info = {
                'name': str(col),
                'total': len(df),
                'non_empty': int(col_data.count()) if hasattr(col_data, 'count') else len(col_data),
                'unique': int(df[col].nunique()),
            }
            
            # ?«ì?•ì¸ì§€ ?•ì¸
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
                # ?ìœ„ ë¹ˆë„ ê°?
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
        return jsonify({'error': f'ë¶„ì„ ?¤ë¥˜: {str(e)}'}), 500


@app.route('/api/save-journal', methods=['POST'])
def save_journal():
    """ë§¤ë§¤?¼ì? ?°ì´??ì¶”ê? ?€??""
    if not ONEDRIVE_PATH:
        return jsonify({'error': 'OneDrive ê²½ë¡œê°€ ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ??'}), 400
    
    data = request.get_json()
    file_path = data.get('file', '')
    sheet_name = data.get('sheet', 'ë§¤ë§¤?¼ì?')
    row_values = data.get('row', [])  # [? ì§œ, ì¢…ëª©, ?˜ëŸ‰, ?¨ê?, ë§¤ë§¤ì¢…ë¥˜, ?¬ìê¸?
    
    full_path = os.path.join(ONEDRIVE_PATH, file_path)
    
    if not os.path.isfile(full_path):
        return jsonify({'error': f'?Œì¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤: {file_path}'}), 404
    
    try:
        from openpyxl.styles import Font, PatternFill

        # ?¬íŠ¸?´ë¦¬??ë§??…ë°?´íŠ¸???¬ìš©???¤í????•ì˜
        yellow_fill = PatternFill(
            fill_type="solid",
            fgColor="FFFF00"   # ?¸ë???
        )
        no_fill = PatternFill(fill_type=None)  # ë°°ê²½???†ìŒ(ì´ˆê¸°?”ìš©)

        # openpyxl???¬ìš©?˜ì—¬ ?°ì´??ì¶”ê?
        wb = openpyxl.load_workbook(full_path)
        try:
            if sheet_name not in wb.sheetnames:
                ws = wb.create_sheet(sheet_name)
            else:
                ws = wb[sheet_name]
            
            # ?°ì´??ì¶”ê?
            ws.append(row_values)
            
            # ë§ˆì?ë§‰ìœ¼ë¡?ì¶”ê????‰ì˜ ?°íŠ¸ ?‰ìƒ ?¤ì •
            last_row = ws.max_row
            trade_type_val = row_values[4] if len(row_values) > 4 else ""
            
            # ?‰ìƒ ê²°ì • (ë§¤ë„: ë¹¨ê°„?? ë§¤ìˆ˜: ê²€?•ìƒ‰)
            font_color = "FF0000" if trade_type_val == "ë§¤ë„" else "000000"
            cell_font = Font(color=font_color)
            
            for col_idx in range(1, len(row_values) + 1):
                ws.cell(row=last_row, column=col_idx).font = cell_font
            
            # --- ?¬íŠ¸?´ë¦¬??ë§??ˆë?ê°??™ê¸°??---
            # row_values: [? ì§œ, ì¢…ëª©, ?˜ëŸ‰, ?¨ê?, ë§¤ë§¤ì¢…ë¥˜, ?¬ìê¸?
            try:
                trade_stock = str(row_values[1]).strip() if len(row_values) > 1 else ""
                # ?¬ìê¸ˆì•¡ ?ˆë?ê°?ê³„ì‚°
                raw_investment = float(row_values[5]) if len(row_values) > 5 else 0
                investment_amount = abs(raw_investment)
                
                if trade_stock:
                    sync_portfolio_map(wb, trade_stock, investment_amount)
                    
                    # ?¤ì œ ë°˜ì˜??ë§ˆí¬ ???¬ê?ì¦???ë§¤ë§¤?¼ì? ?¬ìê¸?ë³´ì •
                    ws_map = wb['?¬íŠ¸?´ë¦¬??ë§?]
                    trade_stock_clean = trade_stock.replace(" ", "")
                    final_ones = 0
                    for r in range(1, ws_map.max_row + 1):
                        cell_val = str(ws_map.cell(row=r, column=4).value or "").strip().replace(" ", "")
                        if cell_val == trade_stock_clean:
                            for c in range(5, 101):
                                if ws_map.cell(row=r, column=c).value == 1:
                                    final_ones += 1
                            ws.cell(row=last_row, column=6).value = final_ones * 100
                            break
                    print(f"[OK] [{trade_stock}] sync done: marks={final_ones}")
            except Exception as inner_e:
                print(f"[ERROR] portfolio map update failed: {inner_e}")
            
            # ìµœì¢… ?€??(ë§¤ë§¤?¼ì? + ?¬íŠ¸?´ë¦¬??ë§?ëª¨ë‘ ë°˜ì˜)
            wb.save(full_path)
            wb.close()
            
            # ?„ì´???±ìš© ?°ì´???ë™ ê°±ì‹ 
            trigger_export()
                
        finally:
            # ?¤ë¥˜ê°€ ë°œìƒ?˜ë”?¼ë„ ?•ì‹¤?˜ê²Œ ?Œì¼???«ì•„ ? ê¸ˆ ?´ì œ
            try: wb.close()
            except: pass
        
        return jsonify({'success': True, 'message': '?±ê³µ?ìœ¼ë¡??€?¥ë˜?ˆìŠµ?ˆë‹¤.'})
    
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': f'?€???¤ë¥˜: {str(e)}'}), 500


@app.route('/api/update-row', methods=['POST'])
def update_row():
    if not ONEDRIVE_PATH:
        return jsonify({'error': 'OneDrive ê²½ë¡œê°€ ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ??'}), 400

    data = request.get_json()
    file_path = data.get('file', '')
    sheet_name = data.get('sheet')
    row_index = int(data.get('rowIndex', 0))
    values = data.get('values', [])

    if not sheet_name:
        return jsonify({'error': 'sheet ê°’ì´ ?„ìš”?©ë‹ˆ??'}), 400

    full_path = os.path.join(ONEDRIVE_PATH, file_path)
    if not os.path.isfile(full_path):
        return jsonify({'error': f'?Œì¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤: {file_path}'}), 404

    try:
        from openpyxl.styles import Alignment
        wb = openpyxl.load_workbook(full_path)
        if sheet_name not in wb.sheetnames:
            return jsonify({'error': f'?œíŠ¸ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤: {sheet_name}'}), 404

        ws = wb[sheet_name]
        target_row = row_index + 2
        for col_idx, value in enumerate(values, start=1):
            cell = ws.cell(row=target_row, column=col_idx)
            # ì·¨ì†Œ??ì²˜ë¦¬
            processed_value = parse_strikethrough_text(value)
            cell.value = processed_value
            
            # ì¤„ë°”ê¿?\n)???¬í•¨???€?€ ?‘ì??ì„œ???œì‹œ?˜ë„ë¡?wrap_text ?¤ì •
            if isinstance(value, str) and '\n' in value:
                cell.alignment = Alignment(wrap_text=True)

        # ë§¤ë§¤?¼ì???ê²½ìš° ?¬íŠ¸?´ë¦¬??ë§??™ê¸°??
        if sheet_name == 'ë§¤ë§¤?¼ì?':
            try:
                stock_name = values[1] if len(values) > 1 else ""
                amount = float(values[5]) if len(values) > 5 else 0
                if stock_name:
                    sync_portfolio_map(wb, stock_name, amount)
            except: pass

        wb.save(full_path)
        wb.close()
        
        # ?„ì´???±ìš© ?°ì´???ë™ ê°±ì‹ 
        trigger_export()
        
        return jsonify({'success': True, 'message': '?‰ì´ ?…ë°?´íŠ¸?˜ì—ˆ?µë‹ˆ??'})
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': f'?…ë°?´íŠ¸ ?¤ë¥˜: {str(e)}'}), 500

@app.route('/api/sync-receive', methods=['GET', 'POST'])
def sync_receive():
    if not ONEDRIVE_PATH:
        return "OneDrive ê²½ë¡œê°€ ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ??", 400

    try:
        import json
        if request.is_json:
            edits = request.get_json()
        else:
            payload = request.values.get('payload')
            if not payload:
                return "No payload provided.", 400
            edits = json.loads(payload)

        if not isinstance(edits, list):
            edits = [edits]

        from openpyxl.styles import Alignment
        import traceback

        # ?‘ì? ?‘ì—… ìµœì†Œ?”ë? ?„í•´ ?Œì¼/?œíŠ¸ë³„ë¡œ ê·¸ë£¹?”í•˜ì§€ ?Šê³  ?¨ìˆœ ë°˜ë³µ (?µìƒ 1~5ê±??´ì™¸?´ë?ë¡?
        for edit in edits:
            file_path = edit.get('file', '')
            sheet_name = edit.get('sheet')
            row_index = int(edit.get('rowIndex', 0))
            values = edit.get('values', [])
            
            full_path = os.path.join(ONEDRIVE_PATH, file_path)
            if not os.path.isfile(full_path):
                continue

            wb = openpyxl.load_workbook(full_path)
            if sheet_name not in wb.sheetnames:
                continue

            ws = wb[sheet_name]
            target_row = row_index + 2
            for col_idx, value in enumerate(values, start=1):
                cell = ws.cell(row=target_row, column=col_idx)
                processed_value = parse_strikethrough_text(value)
                cell.value = processed_value
                if isinstance(value, str) and '\n' in value:
                    cell.alignment = Alignment(wrap_text=True)

            wb.save(full_path)
            wb.close()

        # ?„ì´???±ìš© ?°ì´???ë™ ê°±ì‹ 
        trigger_export()

        return """
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { background: #0F172A; color: white; font-family: sans-serif; text-align: center; padding-top: 100px; }
            h2 { color: #00F2FE; }
            button { background: #00F2FE; color: #0F172A; border: none; padding: 15px 30px; border-radius: 10px; font-size: 18px; font-weight: bold; margin-top: 30px; cursor: pointer; }
          </style>
        </head>
        <body>
          <h2>??PC ?„ì†¡ ?„ë£Œ!</h2>
          <p>?‘ì? ?Œì¼???°ì´?°ê? ?•ìƒ?ìœ¼ë¡??€?¥ë˜?ˆìŠµ?ˆë‹¤.</p>
          <p>ê¹ƒí—ˆë¸??œë²„ ë°˜ì˜ê¹Œì? ??1~2ë¶??Œìš”?????ˆìŠµ?ˆë‹¤.</p>
          <button onclick="window.location.href='https://smuth-swing.github.io/stock-portfolio/mobile/'">?±ìœ¼ë¡??Œì•„ê°€ê¸?/button>
        </body>
        </html>
        """
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return f"?™ê¸°???¤ë¥˜: {str(e)}", 500


def sync_portfolio_map(wb, stock_name, trade_amount):
    """?¬íŠ¸?´ë¦¬??ë§µì˜ ì¢…ëª© ë§ˆí¬(??ë¥??¬ìê¸ˆì•¡??ë§ê²Œ ?™ê¸°??""
    if '?¬íŠ¸?´ë¦¬??ë§? not in wb.sheetnames:
        return
    
    from openpyxl.styles import PatternFill
    yellow_fill = PatternFill(start_color='FFFF00', end_color='FFFF00', fill_type='solid')
    no_fill = PatternFill(fill_type=None)
    
    ws_map = wb['?¬íŠ¸?´ë¦¬??ë§?]
    stock_clean = stock_name.replace(" ", "")
    target_marks = int(abs(trade_amount) // 100)
    
    # ì¢…ëª©ëª…ì´ ?¼ì¹˜?˜ëŠ” ëª¨ë“  ?‰ì„ ì°¾ì•„??ì²˜ë¦¬
    for r in range(1, ws_map.max_row + 1):
        cell_val = str(ws_map.cell(row=r, column=4).value or "").strip().replace(" ", "")
        if cell_val and (stock_clean in cell_val or cell_val in stock_clean):
            # 1. ì´ˆê¸°??
            for c in range(5, 101):
                cell = ws_map.cell(row=r, column=c)
                cell.value = None
                cell.fill = no_fill
            # 2. ë§ˆí‚¹
            if target_marks > 0:
                for i in range(target_marks):
                    col_idx = 5 + i
                    if col_idx <= 100:
                        cell = ws_map.cell(row=r, column=col_idx)
                        cell.value = 1
                        cell.fill = yellow_fill
    print(f"?“Š [{stock_name}] ?¬íŠ¸?´ë¦¬???™ê¸°?? {target_marks}ê°?)


@app.route('/api/delete-row', methods=['POST'])
def delete_row():
    """???? œ API - ë§¤ë§¤?¼ì???ê²½ìš° ?´ì „ ?°ì´?°ë¡œ ?™ê¸°???¬í•¨"""
    if not ONEDRIVE_PATH:
        return jsonify({'error': 'OneDrive ê²½ë¡œê°€ ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ??'}), 400

    data = request.get_json()
    file_path = data.get('file', '')
    sheet_name = data.get('sheet')
    row_index = int(data.get('rowIndex', 0))

    full_path = os.path.join(ONEDRIVE_PATH, file_path)
    if not os.path.isfile(full_path):
        return jsonify({'error': f'?Œì¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤: {file_path}'}), 404

    try:
        wb = openpyxl.load_workbook(full_path)
        if sheet_name not in wb.sheetnames:
            return jsonify({'error': f'?œíŠ¸ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤: {sheet_name}'}), 404

        ws = wb[sheet_name]
        target_row_idx = row_index + 2
        
        # ?? œ ???•ë³´ ê¸°ì–µ
        stock_name = None
        if sheet_name == 'ë§¤ë§¤?¼ì?':
            stock_name = str(ws.cell(row=target_row_idx, column=2).value or "").strip()
        
        # ???? œ
        ws.delete_rows(target_row_idx)
        
        # ë§¤ë§¤?¼ì? ?? œ ???™ê¸°??
        if sheet_name == 'ë§¤ë§¤?¼ì?' and stock_name:
            last_amount = 0
            stock_clean = stock_name.replace(" ", "")
            for r in range(2, ws.max_row + 1):
                cell_val = str(ws.cell(row=r, column=2).value or "").strip().replace(" ", "")
                if cell_val == stock_clean:
                    try:
                        val = ws.cell(row=r, column=6).value
                        if val is not None: last_amount = float(val)
                    except: pass
            
            sync_portfolio_map(wb, stock_name, last_amount)
            print(f"?—‘ï¸?[{stock_name}] ?? œ ë°??´ì „ ?°ì´??{last_amount}) ?™ê¸°??)

        wb.save(full_path)
        wb.close()
        
        # ?„ì´???±ìš© ?°ì´???ë™ ê°±ì‹ 
        trigger_export()
        
        return jsonify({'success': True, 'message': '?‰ì´ ?? œ?˜ì—ˆ?µë‹ˆ??'})
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': f'?? œ ?¤ë¥˜: {str(e)}'}), 500


@app.route('/api/ping')
def ping():
    """
    ?ˆì „ ë³µê? ê°ì????¬ìŠ¤ì²´í¬ ?”ë“œ?¬ì¸??
    ?´ë¼?´ì–¸??PWA)ê°€ ì£¼ê¸°?ìœ¼ë¡??¸ì¶œ?˜ì—¬ ?œë²„ ?ì¡´ ë°??ˆì „ ë³µê?ë¥?ê°ì??œë‹¤.
    """
    import time
    return jsonify({
        'alive': True,
        'timestamp': time.time(),
        'server_time': __import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    })


# ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
# LSì¦ê¶Œ OpenAPI ?°ë™ ?”ë“œ?¬ì¸??
# ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•

@app.route('/api/ls/config', methods=['GET', 'POST'])
def ls_config():
    """LSì¦ê¶Œ API ?¤ì • ?€??/ ì¡°íšŒ"""
    try:
        from ls_api import load_config, save_config
    except ImportError:
        return jsonify({'error': 'ls_api ëª¨ë“ˆ??ì°¾ì„ ???†ìŠµ?ˆë‹¤.'}), 500

    if request.method == 'GET':
        cfg = load_config()
        # ë¹„ë?ë²ˆí˜¸/?œí¬ë¦¿ì? ë§ˆìŠ¤?¹í•˜??ë°˜í™˜
        safe_cfg = {
            'app_key': cfg.get('app_key', ''),
            'app_secret': '****' if cfg.get('app_secret') else '',
            'account': cfg.get('account', ''),
            'account_pw': '****' if cfg.get('account_pw') else '',
            'configured': bool(cfg.get('app_key') and cfg.get('app_secret') and
                               cfg.get('account') and cfg.get('account_pw'))
        }
        return jsonify(safe_cfg)

    # POST: ?¤ì • ?€??
    data = request.get_json()
    cfg = load_config()  # ê¸°ì¡´ ?¤ì • ? ì? (ë¶€ë¶??…ë°?´íŠ¸ ì§€??

    for key in ('app_key', 'app_secret', 'account', 'account_pw'):
        val = data.get(key, '')
        # '****'ê°€ ?¤ì–´?¤ë©´ ê¸°ì¡´ ê°?? ì? (ë§ˆìŠ¤?¹ëœ ê°?ê·¸ë?ë¡?ë³´ë‚¸ ê²½ìš°)
        if val and val != '****':
            cfg[key] = val

    save_config(cfg)
    return jsonify({'success': True, 'message': 'LSì¦ê¶Œ API ?¤ì •???€?¥ë˜?ˆìŠµ?ˆë‹¤.'})


@app.route('/api/ls/fetch-trades', methods=['POST'])
def ls_fetch_trades():
    """
    LSì¦ê¶Œ APIë¡?ì²´ê²° ?´ì—­ ì¡°íšŒ
    Body: { from_date: "YYYYMMDD", to_date: "YYYYMMDD", stock_code: "" }
    """
    try:
        from ls_api import fetch_trade_history
    except ImportError:
        return jsonify({'error': 'ls_api ëª¨ë“ˆ??ì°¾ì„ ???†ìŠµ?ˆë‹¤.'}), 500

    data = request.get_json() or {}
    from_date = data.get('from_date', '')
    to_date = data.get('to_date', '')
    stock_code = data.get('stock_code', '')

    if not from_date or not to_date:
        return jsonify({'error': 'ì¡°íšŒ ê¸°ê°„(from_date, to_date)???…ë ¥?˜ì„¸?? ?•ì‹: YYYYMMDD'}), 400

    try:
        trades = fetch_trade_history(
            from_date=from_date,
            to_date=to_date,
            stock_code=stock_code
        )
        return jsonify({
            'success': True,
            'count': len(trades),
            'from_date': from_date,
            'to_date': to_date,
            'trades': trades
        })
    except ValueError as e:
        # ?¤ì • ë¯¸ì™„ë£????¬ìš©???…ë ¥ ?¤ë¥˜
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': f'LS API ì¡°íšŒ ?¤íŒ¨: {str(e)}'}), 500


@app.route('/api/ls/import-trades', methods=['POST'])
def ls_import_trades():
    """
    ? íƒ??ê±°ë˜?´ì—­??Excel DB(ë§¤ë§¤?¼ì? ?œíŠ¸)???€??
    Body: {
        file: "?Œì¼ê²½ë¡œ",
        trades: [{ date, name, qty, price, type, investment, memo }, ...]
    }
    """
    if not ONEDRIVE_PATH:
        return jsonify({'error': 'OneDrive ê²½ë¡œê°€ ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ??'}), 400

    data = request.get_json() or {}
    file_path = data.get('file', '')
    trades = data.get('trades', [])

    if not file_path:
        return jsonify({'error': 'file ê²½ë¡œë¥?ì§€?•í•˜?¸ìš”.'}), 400
    if not trades:
        return jsonify({'error': '?€?¥í•  ê±°ë˜ ?´ì—­???†ìŠµ?ˆë‹¤.'}), 400

    full_path = os.path.join(ONEDRIVE_PATH, file_path)
    if not os.path.isfile(full_path):
        return jsonify({'error': f'?Œì¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤: {file_path}'}), 404

    try:
        wb = openpyxl.load_workbook(full_path)
        sheet_name = 'ë§¤ë§¤?¼ì?'
        if sheet_name not in wb.sheetnames:
            return jsonify({'error': f'"{sheet_name}" ?œíŠ¸ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.'}), 404

        ws = wb[sheet_name]
        saved_count = 0
        errors = []

        for trade in trades:
            try:
                # ê¸°ì¡´ ë§¤ë§¤?¼ì? ì»¬ëŸ¼ ?œì„œ: [? ì§œ, ì¢…ëª©, ?˜ëŸ‰, ?¨ê?, ë§¤ë§¤ì¢…ë¥˜, ?¬ìê¸?
                row_values = [
                    trade.get('date', ''),
                    trade.get('name', ''),
                    int(trade.get('qty', 0)),
                    int(trade.get('price', 0)),
                    trade.get('type', 'ë§¤ìˆ˜'),
                    float(trade.get('investment', 0)),
                ]
                # ë©”ëª¨ê°€ ?ˆìœ¼ë©?7ë²ˆì§¸ ì»¬ëŸ¼??ì¶”ê?
                memo = trade.get('memo', '')
                if memo:
                    row_values.append(memo)

                ws.append(row_values)

                # ?°íŠ¸ ?‰ìƒ (ë§¤ë„=ë¹¨ê°•, ë§¤ìˆ˜=ê²€??
                last_row = ws.max_row
                font_color = "FF0000" if trade.get('type') == 'ë§¤ë„' else "000000"
                cell_font = Font(color=font_color)
                for col_idx in range(1, len(row_values) + 1):
                    ws.cell(row=last_row, column=col_idx).font = cell_font

                # ?¬íŠ¸?´ë¦¬??ë§??™ê¸°??
                stock_name = trade.get('name', '')
                investment = float(trade.get('investment', 0))
                if stock_name:
                    try:
                        sync_portfolio_map(wb, stock_name, investment)
                    except Exception:
                        pass  # ë§??™ê¸°???¤íŒ¨???€???ì²´ë¥?ë§‰ì? ?ŠìŒ

                saved_count += 1

            except Exception as row_e:
                errors.append(f"{trade.get('name', '?')}: {str(row_e)}")

        wb.save(full_path)
        wb.close()

        # ?„ì´???±ìš© JSON ?ë™ ê°±ì‹ 
        trigger_export()

        msg = f'{saved_count}ê±??€???„ë£Œ'
        if errors:
            msg += f' (?¤ë¥˜ {len(errors)}ê±? {"; ".join(errors[:3])})'

        return jsonify({'success': True, 'saved': saved_count, 'errors': errors, 'message': msg})

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': f'?€???¤ë¥˜: {str(e)}'}), 500

@app.route('/api/ls/current-prices', methods=['POST'])
def ls_current_prices():
    """
    LSì¦ê¶Œ APIë¡??¬ëŸ¬ ì¢…ëª©???„ì¬ê°€ ì¡°íšŒ
    Body: { "shcodes": ["005930", ...], "names": ["?¼ì„±?„ì", "SK?˜ì´?‰ìŠ¤", ...] }
    ë°˜í™˜: { "005930": 80000, "?¼ì„±?„ì": 80000 }
    """
    try:
        from ls_api import fetch_current_prices, get_stock_codes_by_names, load_config, get_access_token
    except ImportError:
        return jsonify({'error': 'ls_api ëª¨ë“ˆ??ì°¾ì„ ???†ìŠµ?ˆë‹¤.'}), 500

    data = request.get_json() or {}
    shcodes = data.get('shcodes', [])
    names = data.get('names', [])
    
    name_to_code = {}
    code_to_name = {}

    if names:
        cfg = load_config()
        token = get_access_token(cfg["app_key"], cfg["app_secret"])
        if token:
            name_to_code = get_stock_codes_by_names(token, names)
            shcodes.extend(name_to_code.values())
            code_to_name = {v: k for k, v in name_to_code.items()}

    shcodes = list(set(shcodes)) # ì¤‘ë³µ ?œê±°

    if not shcodes:
        return jsonify({'error': 'ì¢…ëª© ì½”ë“œ(shcodes)??ì¢…ëª©ëª?names)???œê³µ?´ì£¼?¸ìš”.'}), 400

    try:
        prices = fetch_current_prices(shcodes)
        
        # ?´ë¦„?¼ë¡œ ?”ì²­??ê²½ìš° ?´ë¦„?¼ë¡œ??ê°€ê²?ì¶”ê?
        result_prices = {**prices}
        for code, price in prices.items():
            if code in code_to_name:
                result_prices[code_to_name[code]] = price
                
        return jsonify({
            'success': True,
            'prices': result_prices
        })
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': f'?„ì¬ê°€ ì¡°íšŒ ?¤íŒ¨: {str(e)}'}), 500


@app.route('/api/ls/moving-averages', methods=['GET'])
def ls_moving_averages():
    """
    ?¨ì¼ ì¢…ëª©???´ë™?‰ê· ??5, 20, 60, 120?? ?°ì´??ì¡°íšŒ
    Query: ?shcode=005930 ?ëŠ” ?name=?¼ì„±?„ì
    """
    try:
        from ls_api import fetch_moving_averages, get_stock_codes_by_names, load_config, get_access_token
    except ImportError:
        return jsonify({'error': 'ls_api ëª¨ë“ˆ??ì°¾ì„ ???†ìŠµ?ˆë‹¤.'}), 500

    shcode = request.args.get('shcode', '')
    name = request.args.get('name', '')

    if name and not shcode:
        cfg = load_config()
        token = get_access_token(cfg["app_key"], cfg["app_secret"])
        if token:
            name_to_code = get_stock_codes_by_names(token, [name])
            if name in name_to_code:
                shcode = name_to_code[name]

    if not shcode:
        return jsonify({'error': 'ì¢…ëª© ì½”ë“œ???´ë¦„???œê³µ?´ì£¼?¸ìš”.'}), 400

    try:
        ma_data = fetch_moving_averages(shcode)
        return jsonify({
            'success': True,
            'data': ma_data
        })
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': f'?´ë™?‰ê· ??ì¡°íšŒ ?¤íŒ¨: {str(e)}'}), 500


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
        # ë°°í¬ ?œì—??debug=False ê¶Œì¥
        app.run(debug=False, port=5000, host='0.0.0.0')
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)
