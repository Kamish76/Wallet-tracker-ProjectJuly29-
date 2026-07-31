import React, { useEffect } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/theme/colors';

export default function ActionAddTransactionRoute() {
  const { type } = useLocalSearchParams<{ type?: string }>();

  useEffect(() => {
    const targetType =
      type === 'expense_personal' || type === 'income' || type === 'transfer'
        ? type
        : 'expense_personal';
    // Navigate cleanly to dashboard with the transaction type param
    router.replace(`/dashboard?type=${targetType}`);
  }, [type]);

  return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
}
