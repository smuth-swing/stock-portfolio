import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the rendering loop
start_marker = "if (listContainer) listContainer.appendChild(div);"
end_marker = "});"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    end_idx += len("});")
    new_loop = '''if (listContainer) listContainer.appendChild(div);
                });
                
                // 이벤트 위임을 통한 동적 투자금 재계산
                if (listContainer) {
                    // 이전 리스너 방지를 위해 클론
                    const newContainer = listContainer.cloneNode(true);
                    listContainer.parentNode.replaceChild(newContainer, listContainer);
                    
                    newContainer.addEventListener('input', (e) => {
                        if (e.target.classList.contains('ls-trade-qty') || e.target.classList.contains('ls-trade-price') || e.target.classList.contains('ls-trade-name') || e.target.classList.contains('ls-trade-type')) {
                            const idx = e.target.dataset.idx;
                            const qtyInput = document.querySelector(`.ls-trade-qty[data-idx="${idx}"]`);
                            const priceInput = document.querySelector(`.ls-trade-price[data-idx="${idx}"]`);
                            const nameInput = document.querySelector(`.ls-trade-name[data-idx="${idx}"]`);
                            const typeInput = document.querySelector(`.ls-trade-type[data-idx="${idx}"]`);
                            const invInput = document.querySelector(`.ls-trade-inv[data-idx="${idx}"]`);
                            
                            if (qtyInput && priceInput && nameInput && typeInput && invInput) {
                                const qty = parseFloat(qtyInput.value) || 0;
                                const price = parseFloat(priceInput.value) || 0;
                                const stockName = nameInput.value.trim();
                                const isSell = typeInput.value.trim() === '매도';
                                
                                const baseAmount = portfolioMapCache[stockName] || 0;
                                const tradeOnes = Math.round((qty * price) / 1000000);
                                const tradeAmount = tradeOnes * 100;
                                
                                let computedInvestment = tradeAmount;
                                if (baseAmount > 0) {
                                    if (isSell) {
                                        computedInvestment = Math.max(0, baseAmount - tradeAmount);
                                    } else {
                                        computedInvestment = baseAmount + tradeAmount;
                                    }
                                } else if (isSell) {
                                    computedInvestment = 0;
                                }
                                
                                invInput.value = computedInvestment;
                            }
                        }
                    });
                }
'''
    content = content[:start_idx] + new_loop + content[end_idx:]
    open('app.js', 'w', encoding='utf-8').write(content)
    print('Event delegation added')
else:
    print('Failed to patch app.js')
