import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function AddTransactionDeepLink() {
  const { type } = useLocalSearchParams();
  return <Redirect href={`/(tabs)/dashboard?type=${type || 'expense_personal'}`} />;
}
