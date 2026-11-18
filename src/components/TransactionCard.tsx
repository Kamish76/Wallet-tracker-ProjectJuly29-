import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Edit2, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { Tokens } from '@/theme/tokens';
import { getAccountBadgeText } from '@/lib/utils/balance';
import { formatCurrency } from '@/lib/utils/currency';
import type { WalletTransaction, WalletAccount } from '@/types/wallet';

interface TransactionCardProps {
  tx: WalletTransaction;
  accounts: WalletAccount[];
  onEdit: (tx: WalletTransaction) => void;
  onDelete: (tx: WalletTransaction) => void;
  currency?: string;
}

export const TransactionCard = memo(
  ({ tx, accounts, onEdit, onDelete, currency = 'USD' }: TransactionCardProps) => {
    const { colors, isDark } = useTheme();

    const txColor =
      tx.type === 'income'
        ? colors.income
        : tx.type === 'transfer'
        ? colors.transfer
        : colors.expense;

    return (
      <TouchableOpacity
        style={[
          styles.txCard,
          {
            backgroundColor: colors.surfaceCard,
            borderColor: colors.border,
            shadowColor: isDark ? colors.primary : 'rgba(0, 0, 0, 0.05)',
          },
        ]}
        onPress={() => onEdit(tx)}
        activeOpacity={0.7}
      >
        <View style={styles.txLeft}>
          <View style={[styles.txTypeDot, { backgroundColor: txColor }]} />
          <View>
            <Text style={[styles.txCategory, { color: colors.textWhite }]}>
              {tx.category || (tx.type === 'transfer' ? 'Transfer' : 'Uncategorized')}
            </Text>
            <Text style={[styles.txDate, { color: colors.textMuted }]}>
              <Text style={{ color: colors.textLight, fontWeight: '600' }}>
                {getAccountBadgeText(tx, accounts)}
              </Text>
              {' • '}
              {new Date(tx.occurred_at).toLocaleDateString()}
              {tx.mirrored_from_tx_id ? ' • Mirrored from Org' : ''}
              {tx.sync_status === 'pending' ? ' • (Offline Pending)' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, { color: txColor }]}>
            {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount), currency)}
          </Text>
          <View style={styles.txActions}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onEdit(tx);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Edit2 size={15} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  marginLeft: 14,
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onDelete(tx);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={15} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.tx.id === nextProps.tx.id &&
      prevProps.tx.amount === nextProps.tx.amount &&
      prevProps.tx.category === nextProps.tx.category &&
      prevProps.tx.occurred_at === nextProps.tx.occurred_at &&
      prevProps.tx.sync_status === nextProps.tx.sync_status &&
      prevProps.tx.type === nextProps.tx.type &&
      prevProps.tx.description === nextProps.tx.description &&
      prevProps.tx.mirrored_from_tx_id === nextProps.tx.mirrored_from_tx_id &&
      prevProps.accounts === nextProps.accounts &&
      prevProps.currency === nextProps.currency
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
    marginBottom: 2,
  },
  txDate: {
    fontSize: 13,
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
    borderRadius: Tokens.radius.sm,
    borderWidth: 1,
  },
});
