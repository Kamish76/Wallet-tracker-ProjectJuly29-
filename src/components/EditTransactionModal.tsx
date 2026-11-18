import React from 'react';
import { AddTransactionModal } from './AddTransactionModal';
import type { WalletAccount, WalletTransaction } from '@/types/wallet';

interface EditTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string | null;
  userId: string | null;
  accounts: WalletAccount[];
  transaction: WalletTransaction | null;
  currency?: string;
}

export function EditTransactionModal(props: EditTransactionModalProps) {
  return <AddTransactionModal {...props} />;
}
