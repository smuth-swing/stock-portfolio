with open('server.py', 'r', encoding='utf-8') as f:
    content = f.read()

idx_mobile = content.find('@app.route(\'/mobile/\')')
idx_print = content.rfind('print("=" * 60)')

if idx_mobile != -1 and idx_print != -1:
    idx_start = content.rfind('#', 0, idx_mobile)
    ls_code = open('scratch/ls_code.py', 'r', encoding='utf-8').read()
    
    end_block = content[idx_print:]
    end_block = end_block.replace('\nprint', '\n    print')
    end_block = end_block.replace('\nif ', '\n    if ')
    end_block = end_block.replace('\nelse:', '\n    else:')
    end_block = end_block.replace('\ntry:', '\n    try:')
    end_block = end_block.replace('\n    app.run', '\n        app.run')
    end_block = end_block.replace('\nexcept', '\n    except')
    end_block = end_block.replace('\n    sys.exit', '\n        sys.exit')
    
    new_content = content[:idx_start] + '\n' + ls_code + '\n\nif __name__ == \'__main__\':\n    ' + end_block
    
    open('server.py', 'w', encoding='utf-8').write(new_content)
    print('Patched successfully!')
else:
    print('Failed to patch', idx_mobile, idx_print)
