import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Edit2, Trash2 } from 'lucide-react-native';
import { Colors } from '@/theme/colors';
import { Tokens } from '@/theme/tokens';
import { getAccountBadgeText } from '@/lib/utils/balance';
import type { WalletTransaction, WalletAccount } from '@/types/wallet';

interface TransactionCardProps {
  tx: WalletTransaction;
  accounts: WalletAccount[];
  onEdit: (tx: WalletTransaction) => void;
  onDelete: (tx: WalletTransaction) => void;
}

export const TransactionCard = memo(
  ({ tx, accounts, onEdit, onDelete }: TransactionCardProps) => {
    return (
      <TouchableOpacity
        style={styles.txCard}
        onPress={() => onEdit(tx)}
        activeOpacity={0.7}
      >
        <View style={styles.txLeft}>
          <View
            style={[
              styles.txTypeDot,
              {
                backgroundColor:
                  tx.type === 'income'
                    ? Colors.income
                    : tx.type === 'transfer'
                    ? Colors.transfer
                    : Colors.expense,
              },
            ]}
          />
          <View>
            <Text style={styles.txCategory}>
              {tx.category || (tx.type === 'transfer' ? 'Transfer' : 'Uncategorized')}
            </Text>
            <Text style={styles.txDate}>
              <Text style={{ color: Colors.textLight, fontWeight: '600' }}>
                {getAccountBadgeText(tx, accounts)}
              </Text>
              {' • '}
              {new Date(tx.occurred_at).toLocaleDateString()}
              {tx.sync_status === 'pending' ? ' • (Offline Pending)' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.txRight}>
          <Text
            style={[
              styles.txAmount,
              {
                color:
                  tx.type === 'income'
                    ? Colors.income
                    : tx.type === 'transfer'
                    ? Colors.transfer
                    : Colors.expense,
              },
            ]}
          >
            {tx.type === 'income' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
          </Text>
          <View style={styles.txActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={(e) => {
                e.stopPropagation();
                onEdit(tx);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Edit2 size={15} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { marginLeft: 14 }]}
              onPress={(e) => {
                e.stopPropagation();
                onDelete(tx);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={15} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for React.memo
    // We assume accounts array reference doesn't change unless accounts change, but to be safe:
    return (
      prevProps.tx.id === nextProps.tx.id &&
      prevProps.tx.amount === nextProps.tx.amount &&
      prevProps.tx.category === nextProps.tx.category &&
      prevProps.tx.occurred_at === nextProps.tx.occurred_at &&
      prevProps.tx.sync_status === nextProps.tx.sync_status &&
      prevProps.tx.type === nextProps.tx.type &&
      prevProps.accounts === nextProps.accounts
    );
  }
);

const styles = StyleSheet.create({
  txCard: {
    ...Tokens.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Tokens.spacing.md,
    marginBottom: Tokens.spacing.sm,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  txTypeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Tokens.spacing.md,
  },
  txCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textWhite,
    marginBottom: 2,
  },
  txDate: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  txRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Tokens.spacing.xs,
  },
  txActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  actionBtn: {
    padding: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Tokens.radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
