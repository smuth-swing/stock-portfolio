import sys

def parse_and_move():
    with open('index.html', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    start_idx = -1
    for i, l in enumerate(lines):
        if '<!-- LS증권 거래내역 가져오기 -->' in l:
            start_idx = i
            break
            
    if start_idx == -1:
        print('Could not find start')
        return
        
    # count divs to find end
    div_count = 0
    end_idx = -1
    for i in range(start_idx, len(lines)):
        div_count += lines[i].count('<div')
        div_count -= lines[i].count('</div')
        if div_count == 0 and i > start_idx + 2:
            end_idx = i
            break
            
    if end_idx == -1:
        print('Could not find end')
        return
        
    ls_section = lines[start_idx:end_idx+1]
    
    # remove from original place
    del lines[start_idx:end_idx+1]
    
    # find where to insert
    insert_idx = -1
    for i, l in enumerate(lines):
        if '<div id="journal-panel"' in l:
            insert_idx = i + 1
            break
            
    if insert_idx == -1:
        print('Could not find journal-panel')
        return
        
    # insert
    lines = lines[:insert_idx] + ls_section + lines[insert_idx:]
    
    with open('index.html', 'w', encoding='utf-8') as f:
        f.writelines(lines)
        
    print('Successfully moved section!')

parse_and_move()
