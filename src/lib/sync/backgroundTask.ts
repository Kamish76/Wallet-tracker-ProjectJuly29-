import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { SyncEngine } from './syncEngine';

export const BACKGROUND_SYNC_TASK = 'background-sync-task';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const result = await SyncEngine.syncNow();
    if (result.success) {
      console.log('[BackgroundTask] Background sync successful.');
      return BackgroundTask.BackgroundFetchResult ? BackgroundTask.BackgroundFetchResult.NewData : 1;
    } else {
      console.log('[BackgroundTask] Background sync skipped or failed:', result.error);
      return BackgroundTask.BackgroundFetchResult ? BackgroundTask.BackgroundFetchResult.NoData : 2;
    }
  } catch (error) {
    console.error('[BackgroundTask] Error in background sync:', error);
    return BackgroundTask.BackgroundFetchResult ? BackgroundTask.BackgroundFetchResult.Failed : 3;
  }
});

export async function registerBackgroundSync() {
  try {
    const settings = await SyncEngine.getSettings();
    const intervalSeconds = (settings.intervalMinutes || 15) * 60;
    
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: intervalSeconds,
      stopOnTerminate: false, // android only,
      startOnBoot: true, // android only
    });
    console.log(`[BackgroundTask] Background sync task registered with interval ${intervalSeconds}s.`);
  } catch (err) {
    console.error('[BackgroundTask] Failed to register background sync task:', err);
  }
}
