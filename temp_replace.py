import os

filepath = r"c:\Users\zerod\.antigravity\주식 포트폴리오 관리\app.js"
with open(filepath, "r", encoding="utf-8-sig") as f:
    content = f.read()

target = """    // 2. 개별 종목별로 비동기 MA 조회 (순차적으로 실행하여 API 속도 제한 방지)
    for (const stock of stocks) {
        const safeId = stock.replace(/[^a-zA-Z0-9가-힣]/g, '');
        const row = document.getElementById(signal-row-);
        if (!row) continue;
        
        try {
            const cacheKey = signalData_;
            let data = null;
            const todayStr = new Date().toISOString().split('T')[0];
            
            if (!forceUpdate) {
                try {
                    const stored = localStorage.getItem(cacheKey);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        if (parsed.date === todayStr) {
                            data = parsed.data;
                        }
                    }
                } catch(e) {}
            }
            
            if (!data) {
                const res = await fetch(${API}/ls/moving-averages?name=);
                if (!res.ok) throw new Error('API Error');
                const result = await res.json();
                
                if (result.success && result.data && result.data.current) {
                    data = result.data;
                    try {
                        localStorage.setItem(cacheKey, JSON.stringify({ date: todayStr, data: data }));
                    } catch(e) {}
                }
            }
            
            if (data && data.current) {
                const current = data.current;
                const ma5_month = data.ma5_month || 0;
                
                // 현재가 표시
                row.querySelector('.col-price').innerHTML = <span style="color:var(--highlight); font-weight:bold;">원</span>;
                
                let ma5CurHtml = '<span style="color:#555;">-</span>';
                let ma5NextHtml = '<span style="color:#555;">-</span>';
                let ma120Html = '<span style="color:#555;">-</span>';
                let rsiHtml = '<span style="color:#555;">-</span>';
                
                // 목표가 도달 체크
                const tp = window.targetPricesCache && window.targetPricesCache[stock];
                let isTargetReached = false;
                if (tp) {
                    const high_1w = data.high_1w || current;
                    const low_1w = data.low_1w || current;
                    if (high_1w >= tp && low_1w <= tp) {
                        isTargetReached = true;
                    }
                }
                
                if (isTargetReached) {
                    row.querySelector('td:first-child').innerHTML = ${stock}<br><span style="color:var(--danger); font-size:11px; font-weight:bold;">🚨 목표가 도달</span>;
                    row.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                    row.style.borderLeft = '3px solid var(--danger)';
                }
                
                if (ma5_month > 0) {
                    const ma5_month_next = data.ma5_month_next || ma5_month;
                    
                    if (current < ma5_month_next && !isTargetReached) {
                        row.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                        row.style.borderLeft = '3px solid var(--danger)';
                    }
                    
                    if (current < ma5_month) {
                        const diffCur = Math.abs(((current - ma5_month) / ma5_month) * 100);
                        ma5CurHtml = <span style="color:var(--danger); font-weight:bold; font-size:12px;">% 하회</span>;
                    }
                    
                    if (current < ma5_month_next) {
                        const diffNext = Math.abs(((current - ma5_month_next) / ma5_month_next) * 100);
                        ma5NextHtml = <span style="color:var(--danger); font-weight:bold; font-size:12px;">% 하회</span>;
                    }
                }
                
                const ma120_week = data.ma120_week || 0;
                if (ma120_week > 0) {
                    const diff120Raw = ((current - ma120_week) / ma120_week) * 100;
                    const diff120Abs = Math.abs(diff120Raw);
                    
                    // 0% ~ 5% 이내로 근접한 경우만 표기
                    if (diff120Abs <= 5.0) {
                        if (diff120Raw < 0) {
                            ma120Html = <span style="color:var(--danger); font-weight:bold; font-size:12px;">% 하회</span>;
                        } else {
                            ma120Html = <span style="color:var(--highlight); font-weight:bold; font-size:12px;">% 상회</span>;
                        }
                    }
                }
                
                const rsiD = data.rsi_day || 0;
                const rsiW = data.rsi_week || 0;
                const rsiM = data.rsi_month || 0;
                
                let rsiTexts = [];
                if (rsiD > 0 && rsiD <= 30) rsiTexts.push(일:);
                if (rsiW > 0 && rsiW <= 30) rsiTexts.push(주:);
                if (rsiM > 0 && rsiM <= 30) rsiTexts.push(월:);
                
                if (rsiTexts.length > 0) {
                    rsiHtml = <span style="color:var(--danger); font-weight:bold; font-size:12px;"></span>;
                }
                
                // 기존 컬럼 업데이트
                row.querySelector('.col-ma5-cur').innerHTML = ma5CurHtml;
                row.querySelector('.col-ma5-next').innerHTML = ma5NextHtml;
                row.querySelector('.col-ma120-week').innerHTML = ma120Html;
                row.querySelector('.col-rsi').innerHTML = rsiHtml;
            } else {
                // 오류/조회불가 상태에 대한 기본값 설정
                row.querySelector('.col-ma5-cur').innerHTML = '<span style="color:gray; font-size:12px;">조회 불가</span>';
                row.querySelector('.col-ma5-next').innerHTML = '-';
                row.querySelector('.col-ma120-week').innerHTML = '-';
                row.querySelector('.col-rsi').innerHTML = '-';
            }
        } catch (e) {
            console.error(MA fetch error for :, e);
            row.querySelector('.col-ma5-cur').innerHTML = '<span style="color:gray; font-size:12px;">오류</span>';
            row.querySelector('.col-ma5-next').innerHTML = '-';
            row.querySelector('.col-ma120-week').innerHTML = '-';
            row.querySelector('.col-rsi').innerHTML = '-';
        }
    }"""

replacement = """    // 2. 개별 종목별로 비동기 MA 조회 (재시도 로직 포함)
    let pendingStocks = [...stocks];
    let retryCount = 0;
    const MAX_RETRIES = 10;
    
    while (pendingStocks.length > 0 && retryCount < MAX_RETRIES) {
        if (retryCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            showToast(조회 지연 종목 개 재시도 중... (/회차), 'info');
        }
        
        const nextPending = [];
        
        for (const stock of pendingStocks) {
            const safeId = stock.replace(/[^a-zA-Z0-9가-힣]/g, '');
            const row = document.getElementById(signal-row-);
            if (!row) continue;
            
            try {
                const cacheKey = signalData_;
                let data = null;
                const todayStr = new Date().toISOString().split('T')[0];
                
                if (!forceUpdate) {
                    try {
                        const stored = localStorage.getItem(cacheKey);
                        if (stored) {
                            const parsed = JSON.parse(stored);
                            if (parsed.date === todayStr) {
                                data = parsed.data;
                            }
                        }
                    } catch(e) {}
                }
                
                if (!data) {
                    const res = await fetch(${API}/ls/moving-averages?name=);
                    if (!res.ok) throw new Error('API Error');
                    const result = await res.json();
                    
                    if (result.success && result.data && result.data.current) {
                        data = result.data;
                        try {
                            localStorage.setItem(cacheKey, JSON.stringify({ date: todayStr, data: data }));
                        } catch(e) {}
                    }
                }
                
                if (data && data.current) {
                    const current = data.current;
                    const ma5_month = data.ma5_month || 0;
                    
                    // 현재가 표시
                    row.querySelector('.col-price').innerHTML = <span style="color:var(--highlight); font-weight:bold;">원</span>;
                    
                    let ma5CurHtml = '<span style="color:#555;">-</span>';
                    let ma5NextHtml = '<span style="color:#555;">-</span>';
                    let ma120Html = '<span style="color:#555;">-</span>';
                    let rsiHtml = '<span style="color:#555;">-</span>';
                    
                    // 목표가 도달 체크
                    const tp = window.targetPricesCache && window.targetPricesCache[stock];
                    let isTargetReached = false;
                    if (tp) {
                        const high_1w = data.high_1w || current;
                        const low_1w = data.low_1w || current;
                        if (high_1w >= tp && low_1w <= tp) {
                            isTargetReached = true;
                        }
                    }
                    
                    if (isTargetReached) {
                        row.querySelector('td:first-child').innerHTML = ${stock}<br><span style="color:var(--danger); font-size:11px; font-weight:bold;">🚨 목표가 도달</span>;
                        row.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                        row.style.borderLeft = '3px solid var(--danger)';
                    }
                    
                    if (ma5_month > 0) {
                        const ma5_month_next = data.ma5_month_next || ma5_month;
                        
                        if (current < ma5_month_next && !isTargetReached) {
                            row.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                            row.style.borderLeft = '3px solid var(--danger)';
                        }
                        
                        if (current < ma5_month) {
                            const diffCur = Math.abs(((current - ma5_month) / ma5_month) * 100);
                            ma5CurHtml = <span style="color:var(--danger); font-weight:bold; font-size:12px;">% 하회</span>;
                        }
                        
                        if (current < ma5_month_next) {
                            const diffNext = Math.abs(((current - ma5_month_next) / ma5_month_next) * 100);
                            ma5NextHtml = <span style="color:var(--danger); font-weight:bold; font-size:12px;">% 하회</span>;
                        }
                    }
                    
                    const ma120_week = data.ma120_week || 0;
                    if (ma120_week > 0) {
                        const diff120Raw = ((current - ma120_week) / ma120_week) * 100;
                        const diff120Abs = Math.abs(diff120Raw);
                        
                        if (diff120Abs <= 5.0) {
                            if (diff120Raw < 0) {
                                ma120Html = <span style="color:var(--danger); font-weight:bold; font-size:12px;">% 하회</span>;
                            } else {
                                ma120Html = <span style="color:var(--highlight); font-weight:bold; font-size:12px;">% 상회</span>;
                            }
                        }
                    }
                    
                    const rsiD = data.rsi_day || 0;
                    const rsiW = data.rsi_week || 0;
                    const rsiM = data.rsi_month || 0;
                    
                    let rsiTexts = [];
                    if (rsiD > 0 && rsiD <= 30) rsiTexts.push(일:);
                    if (rsiW > 0 && rsiW <= 30) rsiTexts.push(주:);
                    if (rsiM > 0 && rsiM <= 30) rsiTexts.push(월:);
                    
                    if (rsiTexts.length > 0) {
                        rsiHtml = <span style="color:var(--danger); font-weight:bold; font-size:12px;"></span>;
                    }
                    
                    row.querySelector('.col-ma5-cur').innerHTML = ma5CurHtml;
                    row.querySelector('.col-ma5-next').innerHTML = ma5NextHtml;
                    row.querySelector('.col-ma120-week').innerHTML = ma120Html;
                    row.querySelector('.col-rsi').innerHTML = rsiHtml;
                } else {
                    nextPending.push(stock);
                    row.querySelector('.col-ma5-cur').innerHTML = '<span style="color:gray; font-size:12px;">조회 지연 (재시도 대기)</span>';
                }
            } catch (e) {
                console.error(MA fetch error for :, e);
                nextPending.push(stock);
                row.querySelector('.col-ma5-cur').innerHTML = '<span style="color:gray; font-size:12px;">재시도 대기</span>';
            }
        }
        
        pendingStocks = nextPending;
        retryCount++;
    }
    
    for (const stock of pendingStocks) {
        const safeId = stock.replace(/[^a-zA-Z0-9가-힣]/g, '');
        const row = document.getElementById(signal-row-);
        if (!row) continue;
        row.querySelector('.col-ma5-cur').innerHTML = '<span style="color:gray; font-size:12px;">조회 불가</span>';
        row.querySelector('.col-ma5-next').innerHTML = '-';
        row.querySelector('.col-ma120-week').innerHTML = '-';
        row.querySelector('.col-rsi').innerHTML = '-';
    }"""

# Normalize spaces to ensure match
target_norm = " ".join(target.split())
content_norm = " ".join(content.split())

if target_norm in content_norm:
    # Need to find the actual start and end index to replace precisely
    # A simple regex ignoring whitespace differences:
    import re
    pattern = re.escape(target)
    pattern = re.sub(r'\\\s+', r'\\s+', pattern) # allow any whitespace
    
    if bool(re.search(pattern, content)):
        content = re.sub(pattern, replacement, content)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print("Replaced successfully.")
    else:
        print("Pattern built but not matched.")
else:
    print("Target not found in normalized content.")
