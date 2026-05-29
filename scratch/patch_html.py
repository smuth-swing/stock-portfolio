"""index.html의 journal-panel에 LS증권 가져오기 섹션 삽입"""

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 삽입할 HTML (journal-trend-container 닫는 div 뒤, journal-panel 닫는 div 앞)
ls_section = '''
                <!-- LS증권 거래내역 가져오기 -->
                <div id="ls-import-section" style="border-top:1px solid var(--border-glass); padding:20px 24px;">
                    <div onclick="toggleLsImportPanel()" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                        <h4 style="margin:0; font-size:13px; color:var(--gold-light); display:flex; align-items:center; gap:8px;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            LS증권 거래내역 가져오기
                        </h4>
                        <span id="ls-import-chevron" style="color:var(--text-secondary);font-size:11px;">▼ 펼치기</span>
                    </div>
                    <div id="ls-import-body" style="display:none; margin-top:18px;">
                        <!-- 컨트롤: 계좌 + 기간 -->
                        <div style="display:flex; flex-wrap:wrap; gap:14px; align-items:flex-end; margin-bottom:16px;">
                            <div class="form-group" style="margin:0; min-width:200px; flex:1;">
                                <label for="ls-account-select">계좌</label>
                                <select id="ls-account-select" style="width:100%;"><option value="">로딩 중...</option></select>
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label for="ls-from-date">시작일</label>
                                <input type="date" id="ls-from-date" style="width:150px;">
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label for="ls-to-date">종료일</label>
                                <input type="date" id="ls-to-date" style="width:150px;">
                            </div>
                            <div style="display:flex; gap:6px; align-items:center; padding-bottom:2px;">
                                <button type="button" class="btn-ghost-sm" onclick="setLsDateRange(7)">7일</button>
                                <button type="button" class="btn-ghost-sm" onclick="setLsDateRange(30)">1개월</button>
                                <button type="button" class="btn-ghost-sm" onclick="setLsDateRange(90)">3개월</button>
                                <button type="button" class="btn-primary" onclick="fetchLsTrades()" style="height:38px; padding:0 20px; margin-left:6px;">🔍 조회</button>
                            </div>
                        </div>
                        <!-- 상태 메시지 -->
                        <div id="ls-status-msg" style="display:none; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:12px;"></div>
                        <!-- 결과 -->
                        <div id="ls-trades-result" style="display:none;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                                <span id="ls-result-count" style="font-size:13px; color:var(--gold-light); font-weight:600;"></span>
                                <div style="display:flex; gap:10px; align-items:center;">
                                    <label style="font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:6px; cursor:pointer;">
                                        <input type="checkbox" id="ls-select-all" checked onchange="lsToggleAll(this.checked)" style="width:14px; height:14px; accent-color:var(--gold-primary);"> 전체 선택
                                    </label>
                                    <button type="button" class="btn-primary" onclick="importLsTrades()" style="height:34px; padding:0 18px; font-size:13px;">💾 선택 저장</button>
                                </div>
                            </div>
                            <div style="overflow-x:auto; border-radius:10px; border:1px solid var(--border-glass);">
                                <table id="ls-trades-table" style="width:100%; border-collapse:collapse; font-size:12px;">
                                    <thead>
                                        <tr style="background:rgba(255,255,255,0.04); color:var(--text-secondary); text-align:left;">
                                            <th style="padding:10px; width:36px; text-align:center;">✓</th>
                                            <th style="padding:10px 8px;">날짜</th>
                                            <th style="padding:10px 8px;">종목명</th>
                                            <th style="padding:10px 8px; text-align:center;">매매</th>
                                            <th style="padding:10px 8px; text-align:right;">수량</th>
                                            <th style="padding:10px 8px; text-align:right;">단가</th>
                                            <th style="padding:10px 8px; text-align:right;">투자금(만원)</th>
                                            <th style="padding:10px 8px; min-width:130px;">메모</th>
                                        </tr>
                                    </thead>
                                    <tbody id="ls-trades-tbody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>'''

# journal-trend-container 닫는 부분 찾아서 바로 뒤에 삽입
# 탐구생활 주석 바로 앞에 삽입
target = '<!-- 탐구생활 전용: 좌우 분할 뷰 -->'
if target in content:
    new_content = content.replace(target, ls_section + '\n\n            ' + target, 1)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('성공: LS 패널 삽입 완료')
else:
    print('실패: 삽입 위치를 찾을 수 없음')
    print('탐구생활 문자열 존재 여부:', '탐구생활' in content)
