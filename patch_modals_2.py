import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
        
    start_idx = -1
    end_idx = -1
    for i, line in enumerate(lines):
        if '// Safely evaluates arithmetic expressions without eval' in line:
            start_idx = i
        if start_idx != -1 and line.startswith('}'):
            # The function ends with `}` on its own line after the catch block
            # Actually, `evaluateMathExpression` ends with `  }\n}\n`. Wait.
            if i > start_idx + 50 and line.strip() == '}':
                # Check if it's the right brace
                if lines[i-1].strip() == 'return 0;':
                    end_idx = i
                    break
    
    if start_idx != -1 and end_idx != -1:
        del lines[start_idx:end_idx+1]
        
    content = "".join(lines)
    
    with open(filepath, 'w') as f:
        f.write(content)

fix_file('src/components/AddTransactionModal.tsx')
fix_file('src/components/EditTransactionModal.tsx')
