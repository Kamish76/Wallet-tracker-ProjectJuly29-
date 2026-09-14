import { Redirect } from 'expo-router';
import React from 'react';

export default function HomeDeepLink() {
  return <Redirect href="/(tabs)/dashboard" />;
}
