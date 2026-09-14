const fs = require('fs');

let code = fs.readFileSync('src/components/AddTransactionModal.tsx', 'utf8');

code = code.replace(
  "import { X, Plus, Delete, AlertCircle, ChevronDown } from 'lucide-react-native';",
  "import { X, Plus, Delete, Trash2, AlertCircle, ChevronDown } from 'lucide-react-native';"
);

code = code.replace('interface AddTransactionModalProps', 'interface EditTransactionModalProps');
code = code.replace('initialType?: TransactionType;', 'transaction: WalletTransaction | null;');
code = code.replace('export function AddTransactionModal({', 'export function EditTransactionModal({');
code = code.replace('}: AddTransactionModalProps)', '}: EditTransactionModalProps)');
code = code.replace('initialType,', 'transaction,');

code = code.replace(/const \[prevInitialType.*?if \(initialType\) setTxType\(initialType\);\n  \}/s, '');

const initEffect = `
  useEffect(() => {
    if (visible && transaction) {
      setTxType(transaction.type);
      setDisplayExpr(String(transaction.amount ?? '0'));
      setAccountId(transaction.account_id ?? (accounts[0]?.id || ''));
      setTransferToId(transaction.transfer_to_account_id ?? '');
      setCategory(transaction.category ?? '');
      setNotes(transaction.description ?? '');
    } else {
      setShowCustomCatInput(false);
      setCustomCatName('');
      setShowAccountDropdown(null);
      setShowCategoryDropdown(false);
      setDisplayExpr('0');
      setCategory('');
      setNotes('');
      setTransferToId('');
    }
  }, [visible, transaction, accounts]);
`;
code = code.replace(/useEffect\(\(\) => \{\n    if \(visible\) \{\n      console\.log.*?setTransferToId\(''\);\n    \}\n  \}, \[visible\]\);/s, initEffect);

const newHandlers = `
  const handleSaveTransaction = async () => {
    if (!orgId || !userId || !transaction) return;
    const evaluatedAmount = evaluateMathExpression(displayExpr);
    if (evaluatedAmount === 0) {
      Alert.alert('Invalid Amount', 'Transaction amount cannot be 0.');
      return;
    }
    const finalAmount = Math.abs(evaluatedAmount);
    if (!accountId) {
      Alert.alert('No Account', 'Please select a wallet sub-account.');
      return;
    }
    if (txType === 'transfer' && (!transferToId || transferToId === accountId)) {
      Alert.alert(
        'Invalid Transfer',
        'Destination account must be different from source account.'
      );
      return;
    }

    setSaving(true);
    try {
      await RateLimiter.assertAllowed('mutation:create', RateLimitPolicies.MUTATION_CREATE);
      await RateLimiter.recordAttempt('mutation:create', RateLimitPolicies.MUTATION_CREATE);

      const updatedTx: WalletTransaction = {
        ...transaction,
        type: txType,
        amount: finalAmount,
        account_id: accountId,
        transfer_to_account_id: txType === 'transfer' ? (transferToId || null) : null,
        category: SecurityService.sanitizeText(category, 60) || null,
        description: SecurityService.sanitizeText(notes, 200) || null,
        sync_status: 'pending',
      };

      await OfflineDatabase.upsertTransaction(updatedTx, 'pending');
      await OfflineDatabase.enqueueMutation('UPDATE_TRANSACTION', updatedTx);

      if (SyncEngine.getOnlineStatus()) {
        SyncEngine.syncNow(orgId).catch(() => {});
      }
      WidgetService.refreshWidgetData(orgId || undefined).catch(() => {});

      resetForm();
      onSuccess();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update transaction.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = () => {
    if (!orgId || !transaction) return;
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await RateLimiter.assertAllowed('mutation:create', RateLimitPolicies.MUTATION_CREATE);
              await RateLimiter.recordAttempt('mutation:create', RateLimitPolicies.MUTATION_CREATE);

              await OfflineDatabase.deleteTransaction(transaction.id, orgId);
              await OfflineDatabase.enqueueMutation('DELETE_TRANSACTION', {
                id: transaction.id,
                organization_id: orgId,
              });

              if (SyncEngine.getOnlineStatus()) {
                SyncEngine.syncNow(orgId).catch(() => {});
              }
              WidgetService.refreshWidgetData(orgId || undefined).catch(() => {});

              onSuccess();
              onClose();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete transaction.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };
`;
code = code.replace(/const handleAddTransaction = async \(\) => \{.*?\}\n  \};\n/s, newHandlers);

code = code.replace('<Text style={styles.modalTitle}>Add Transaction</Text>', '<Text style={styles.modalTitle}>Edit Transaction</Text>');
code = code.replace('onPress={handleAddTransaction}', 'onPress={handleSaveTransaction}');
code = code.replace("{saving ? 'Saving...' : 'Save Transaction'}", "{saving ? 'Saving...' : 'Save Changes'}");

const deleteBtn = `
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteTransaction}
            disabled={saving}
          >
            <Trash2 size={18} color={Colors.error} style={{ marginRight: 8 }} />
            <Text style={styles.deleteButtonText}>Delete Transaction</Text>
          </TouchableOpacity>
`;
code = code.replace('          {/* Keypad */}', deleteBtn + '          {/* Keypad */}');

const deleteStyle = `
  deleteButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: Tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },
`;
code = code.replace('  saveButtonText: {', deleteStyle + '  saveButtonText: {');

code = code.replace("const [txType, setTxType] = useState<TransactionType>('expense_personal');", "if (!transaction && visible) return null;\n  const [txType, setTxType] = useState<TransactionType>('expense_personal');");

fs.writeFileSync('src/components/EditTransactionModal.tsx', code);
console.log('Successfully updated EditTransactionModal.tsx');
