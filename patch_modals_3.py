import re

def strip_function(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Match from // Safely evaluates... up to and including the closing brace of the function
    # The function ends with:
    #   } catch {
    #     return 0;
    #   }
    # }
    
    new_content = re.sub(r'// Safely evaluates arithmetic expressions without eval\(\)\nfunction evaluateMathExpression\(expr: string\): number \{.*?^\}\n', '', content, flags=re.MULTILINE | re.DOTALL)
    
    with open(filepath, 'w') as f:
        f.write(new_content)

strip_function('src/components/AddTransactionModal.tsx')
strip_function('src/components/EditTransactionModal.tsx')
