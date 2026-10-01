import re
import sys

def patch_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Replace imports (add KeyboardAvoidingView, Platform, evaluateMathExpression)
    content = content.replace("ScrollView,\n  InteractionManager,\n} from 'react-native';", "ScrollView,\n  InteractionManager,\n  KeyboardAvoidingView,\n  Platform,\n} from 'react-native';")
    content = content.replace("import { OfflineDatabase } from '@/lib/database/sqlite';", "import { evaluateMathExpression } from '@/lib/utils/math';\nimport { OfflineDatabase } from '@/lib/database/sqlite';")

    # 2. Remove evaluateMathExpression function completely
    content = re.sub(r'// Safely evaluates arithmetic expressions without eval\(\).*?function evaluateMathExpression[\s\S]*?^}\n', '', content, flags=re.MULTILINE)

    # 3. Fix security flaw in handleAddTransaction / handleSaveTransaction
    # Find the block where `finalAmount` is used
    amount_fix = """    const evaluatedAmount = evaluateMathExpression(displayExpr);
    const valValidation = SecurityService.validateAmount(Math.abs(evaluatedAmount));
    if (!valValidation.isValid) {
      Alert.alert('Invalid Amount', valValidation.error || 'Transaction amount cannot be 0.');
      return;
    }
    const finalAmount = valValidation.value;"""
    
    content = re.sub(
        r'    const evaluatedAmount = evaluateMathExpression\(displayExpr\);\n    if \(evaluatedAmount === 0\) \{\n      Alert\.alert\(\'Invalid Amount\', \'Transaction amount cannot be 0\.\'\);\n      return;\n    \}\n    const finalAmount = Math\.abs\(evaluatedAmount\);',
        amount_fix,
        content
    )
    
    # 4. Fix KeyboardAvoidingView
    content = content.replace(
        '<Modal visible={visible} animationType="slide" transparent>\n      <View style={styles.modalOverlay}>',
        '<Modal visible={visible} animationType="slide" transparent>\n      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === \'ios\' ? \'padding\' : undefined}>\n      <View style={styles.modalOverlay}>'
    )
    # We need to close it too
    content = content.replace(
        '      </View>\n    </Modal>',
        '      </View>\n      </KeyboardAvoidingView>\n    </Modal>'
    )

    # 5. Fix hardcoded background colors
    content = content.replace(
        "backgroundColor: 'rgba(0, 0, 0, 0.75)'",
        "backgroundColor: Colors.overlay"
    )

    with open(filepath, 'w') as f:
        f.write(content)

patch_file('src/components/AddTransactionModal.tsx')
patch_file('src/components/EditTransactionModal.tsx')
