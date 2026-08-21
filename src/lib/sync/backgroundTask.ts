import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { SyncEngine } from './syncEngine';

export const BACKGROUND_SYNC_TASK = 'background-sync-task';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const result = await SyncEngine.syncNow();
    if (result.success) {
      console.log('[BackgroundTask] Background sync successful.');
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } else {
      console.log('[BackgroundTask] Background sync skipped or failed:', result.error);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
  } catch (error) {
    console.error('[BackgroundTask] Error in background sync:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  try {
    const settings = await SyncEngine.getSettings();
    const intervalSeconds = (settings.intervalMinutes || 15) * 60;
    
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: intervalSeconds,
      stopOnTerminate: false, // android only,
      startOnBoot: true, // android only
    });
    console.log(`[BackgroundTask] Background sync task registered with interval ${intervalSeconds}s.`);
  } catch (err) {
    console.error('[BackgroundTask] Failed to register background sync task:', err);
  }
}
