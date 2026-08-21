import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widgets/widgetTaskHandler';

// Import background task definition to ensure TaskManager.defineTask is evaluated
import './src/lib/sync/backgroundTask'; 

// Register background widget handler globally before React tree mounts
registerWidgetTaskHandler(widgetTaskHandler);

// Initialize Expo Router app
import 'expo-router/entry';
