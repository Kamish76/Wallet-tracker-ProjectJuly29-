import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { SyncEngine } from './syncEngine';

export const BACKGROUND_SYNC_TASK = 'background-sync-task';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const result = await SyncEngine.syncNow();
    if (result.success) {
      console.log('[BackgroundTask] Background sync successful.');
      return BackgroundTask.BackgroundTaskResult.Success;
    } else {
      console.log('[BackgroundTask] Background sync skipped or failed:', result.error);
      return BackgroundTask.BackgroundTaskResult.Success;
    }
  } catch (error) {
    console.error('[BackgroundTask] Error in background sync:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync() {
  try {
    const settings = await SyncEngine.getSettings();
    const intervalMinutes = Math.max(15, settings.intervalMinutes || 15);
    
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: intervalMinutes,
    });
    console.log(`[BackgroundTask] Background sync task registered with interval ${intervalMinutes}m.`);
  } catch (err) {
    console.error('[BackgroundTask] Failed to register background sync task:', err);
  }
}
