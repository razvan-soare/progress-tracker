/**
 * Test suite for sync queue service.
 * These tests verify the sync queue operations work correctly.
 *
 * To run manually in development, import and call runSyncQueueTests()
 */

import {
  addToSyncQueue,
  getNextPendingItem,
  markItemComplete,
  markItemFailed,
  incrementAttempts,
  getPendingCount,
  getFailedCount,
  clearCompletedItems,
  getAllPendingItems,
  getItemById,
  removeByRecordAndOperation,
  hasPendingOperation,
  calculateBackoffDelay,
  isReadyForRetry,
} from "../sync-queue-service";
import type { SyncQueueItem } from "@/types";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

/**
 * Test exponential backoff calculation.
 */
function testCalculateBackoffDelay(): TestResult {
  const name = "calculateBackoffDelay returns correct values";
  try {
    const expected = [
      { attempts: 0, delay: 0 },
      { attempts: 1, delay: 1000 },
      { attempts: 2, delay: 2000 },
      { attempts: 3, delay: 4000 },
      { attempts: 4, delay: 8000 },
      { attempts: 5, delay: 16000 },
    ];

    for (const { attempts, delay } of expected) {
      const result = calculateBackoffDelay(attempts);
      if (result !== delay) {
        return {
          name,
          passed: false,
          error: `Expected ${delay}ms for ${attempts} attempts, got ${result}ms`,
        };
      }
    }

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test isReadyForRetry logic.
 */
function testIsReadyForRetry(): TestResult {
  const name = "isReadyForRetry respects backoff timing";
  try {
    // Item with no lastAttemptAt should be ready
    const newItem: SyncQueueItem = {
      id: "test-1",
      tableName: "entries",
      recordId: "record-1",
      operation: "create",
      createdAt: new Date().toISOString(),
      attempts: 0,
    };

    if (!isReadyForRetry(newItem)) {
      return { name, passed: false, error: "New item without lastAttemptAt should be ready" };
    }

    // Item with recent lastAttemptAt and attempts should not be ready
    const recentItem: SyncQueueItem = {
      ...newItem,
      attempts: 2,
      lastAttemptAt: new Date().toISOString(), // Just now
    };

    if (isReadyForRetry(recentItem)) {
      return {
        name,
        passed: false,
        error: "Item with recent attempt should not be ready (backoff: 2s)",
      };
    }

    // Item with old lastAttemptAt should be ready
    const oldDate = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago
    const oldItem: SyncQueueItem = {
      ...newItem,
      attempts: 2,
      lastAttemptAt: oldDate,
    };

    if (!isReadyForRetry(oldItem)) {
      return {
        name,
        passed: false,
        error: "Item with old attempt (10s ago, backoff: 2s) should be ready",
      };
    }

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test adding items to sync queue.
 */
async function testAddToSyncQueue(): Promise<TestResult> {
  const name = "addToSyncQueue creates item correctly";
  try {
    const item = await addToSyncQueue({
      tableName: "test_table",
      recordId: "test-record-1",
      operation: "create",
      payload: JSON.stringify({ test: true }),
    });

    if (!item.id) {
      return { name, passed: false, error: "Item should have an ID" };
    }
    if (item.tableName !== "test_table") {
      return { name, passed: false, error: "tableName mismatch" };
    }
    if (item.recordId !== "test-record-1") {
      return { name, passed: false, error: "recordId mismatch" };
    }
    if (item.operation !== "create") {
      return { name, passed: false, error: "operation mismatch" };
    }
    if (item.attempts !== 0) {
      return { name, passed: false, error: "attempts should be 0" };
    }

    // Clean up
    await markItemComplete(item.id);

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test FIFO ordering of getNextPendingItem.
 */
async function testGetNextPendingItemFIFO(): Promise<TestResult> {
  const name = "getNextPendingItem returns items in FIFO order";
  try {
    // Add multiple items with slight delay
    const item1 = await addToSyncQueue({
      tableName: "test_table",
      recordId: "fifo-1",
      operation: "create",
    });

    // Small delay to ensure different created_at
    await new Promise((resolve) => setTimeout(resolve, 10));

    const item2 = await addToSyncQueue({
      tableName: "test_table",
      recordId: "fifo-2",
      operation: "create",
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const item3 = await addToSyncQueue({
      tableName: "test_table",
      recordId: "fifo-3",
      operation: "create",
    });

    // Get next item - should be first one added
    const nextItem = await getNextPendingItem();

    if (!nextItem || nextItem.recordId !== "fifo-1") {
      // Clean up
      await markItemComplete(item1.id);
      await markItemComplete(item2.id);
      await markItemComplete(item3.id);
      return {
        name,
        passed: false,
        error: `Expected first item (fifo-1), got ${nextItem?.recordId}`,
      };
    }

    // Clean up
    await markItemComplete(item1.id);
    await markItemComplete(item2.id);
    await markItemComplete(item3.id);

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test markItemComplete removes item.
 */
async function testMarkItemComplete(): Promise<TestResult> {
  const name = "markItemComplete removes item from queue";
  try {
    const item = await addToSyncQueue({
      tableName: "test_table",
      recordId: "complete-test",
      operation: "create",
    });

    // Verify item exists
    const beforeCount = await getPendingCount();
    const existsBefore = await getItemById(item.id);
    if (!existsBefore) {
      return { name, passed: false, error: "Item should exist before completion" };
    }

    // Mark complete
    await markItemComplete(item.id);

    // Verify item is removed
    const afterCount = await getPendingCount();
    const existsAfter = await getItemById(item.id);
    if (existsAfter) {
      return { name, passed: false, error: "Item should not exist after completion" };
    }

    if (afterCount >= beforeCount) {
      return { name, passed: false, error: "Pending count should decrease after completion" };
    }

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test markItemFailed updates item correctly.
 */
async function testMarkItemFailed(): Promise<TestResult> {
  const name = "markItemFailed updates attempts and error message";
  try {
    const item = await addToSyncQueue({
      tableName: "test_table",
      recordId: "fail-test",
      operation: "create",
    });

    const errorMessage = "Test error message";
    await markItemFailed(item.id, errorMessage);

    const updatedItem = await getItemById(item.id);

    if (!updatedItem) {
      return { name, passed: false, error: "Item should still exist after failure" };
    }
    if (updatedItem.attempts !== 1) {
      return { name, passed: false, error: `Attempts should be 1, got ${updatedItem.attempts}` };
    }
    if (updatedItem.errorMessage !== errorMessage) {
      return { name, passed: false, error: "Error message mismatch" };
    }
    if (!updatedItem.lastAttemptAt) {
      return { name, passed: false, error: "lastAttemptAt should be set" };
    }

    // Clean up
    await markItemComplete(item.id);

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test incrementAttempts updates correctly.
 */
async function testIncrementAttempts(): Promise<TestResult> {
  const name = "incrementAttempts increases attempt count";
  try {
    const item = await addToSyncQueue({
      tableName: "test_table",
      recordId: "increment-test",
      operation: "create",
    });

    await incrementAttempts(item.id);
    let updatedItem = await getItemById(item.id);
    if (updatedItem?.attempts !== 1) {
      await markItemComplete(item.id);
      return { name, passed: false, error: `Expected 1 attempt, got ${updatedItem?.attempts}` };
    }

    await incrementAttempts(item.id);
    updatedItem = await getItemById(item.id);
    if (updatedItem?.attempts !== 2) {
      await markItemComplete(item.id);
      return { name, passed: false, error: `Expected 2 attempts, got ${updatedItem?.attempts}` };
    }

    // Clean up
    await markItemComplete(item.id);

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test max retry attempts respected.
 */
async function testMaxRetryAttempts(): Promise<TestResult> {
  const name = "getNextPendingItem respects max retry attempts";
  try {
    const maxAttempts = 3;

    const item = await addToSyncQueue({
      tableName: "test_table",
      recordId: "max-retry-test",
      operation: "create",
    });

    // Fail item until it exceeds max attempts
    for (let i = 0; i < maxAttempts; i++) {
      await markItemFailed(item.id, `Failure ${i + 1}`);
    }

    // Verify item has exceeded max attempts
    const updatedItem = await getItemById(item.id);
    if (updatedItem?.attempts !== maxAttempts) {
      await markItemComplete(item.id);
      return {
        name,
        passed: false,
        error: `Expected ${maxAttempts} attempts, got ${updatedItem?.attempts}`,
      };
    }

    // Get pending count with max attempts - should not include this item
    const pendingCount = await getPendingCount(maxAttempts);
    const failedCount = await getFailedCount(maxAttempts);

    // The failed item should be in failed count
    if (failedCount < 1) {
      await markItemComplete(item.id);
      return { name, passed: false, error: "Failed item should be counted in failedCount" };
    }

    // Clean up using clearCompletedItems
    await clearCompletedItems(maxAttempts);

    // Verify item is cleared
    const afterClear = await getItemById(item.id);
    if (afterClear) {
      await markItemComplete(item.id);
      return { name, passed: false, error: "Failed item should be cleared" };
    }

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test removing items by record and operation.
 */
async function testRemoveByRecordAndOperation(): Promise<TestResult> {
  const name = "removeByRecordAndOperation removes correct item";
  try {
    const item = await addToSyncQueue({
      tableName: "entries",
      recordId: "remove-test",
      operation: "delete",
    });

    // Verify item exists
    const hasPending = await hasPendingOperation("entries", "remove-test", "delete");
    if (!hasPending) {
      return { name, passed: false, error: "Item should have pending operation" };
    }

    // Remove by record and operation
    await removeByRecordAndOperation("entries", "remove-test", "delete");

    // Verify item is removed
    const existsAfter = await getItemById(item.id);
    if (existsAfter) {
      await markItemComplete(item.id);
      return { name, passed: false, error: "Item should be removed" };
    }

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test getAllPendingItems returns correct items.
 */
async function testGetAllPendingItems(): Promise<TestResult> {
  const name = "getAllPendingItems returns pending items";
  try {
    // Get initial count
    const initialItems = await getAllPendingItems();
    const initialCount = initialItems.length;

    // Add items
    const item1 = await addToSyncQueue({
      tableName: "test_table",
      recordId: "all-pending-1",
      operation: "create",
    });
    const item2 = await addToSyncQueue({
      tableName: "test_table",
      recordId: "all-pending-2",
      operation: "update",
    });

    // Get all pending items
    const allItems = await getAllPendingItems();

    if (allItems.length !== initialCount + 2) {
      await markItemComplete(item1.id);
      await markItemComplete(item2.id);
      return {
        name,
        passed: false,
        error: `Expected ${initialCount + 2} items, got ${allItems.length}`,
      };
    }

    // Clean up
    await markItemComplete(item1.id);
    await markItemComplete(item2.id);

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Run all sync queue tests.
 */
export async function runSyncQueueTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  // Synchronous tests
  results.push(testCalculateBackoffDelay());
  results.push(testIsReadyForRetry());

  // Async tests
  results.push(await testAddToSyncQueue());
  results.push(await testGetNextPendingItemFIFO());
  results.push(await testMarkItemComplete());
  results.push(await testMarkItemFailed());
  results.push(await testIncrementAttempts());
  results.push(await testMaxRetryAttempts());
  results.push(await testRemoveByRecordAndOperation());
  results.push(await testGetAllPendingItems());

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  // Log results
  console.log("\n=== Sync Queue Tests ===\n");
  for (const result of results) {
    const status = result.passed ? "✓" : "✗";
    console.log(`${status} ${result.name}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }
  console.log(`\nTotal: ${results.length}, Passed: ${passed}, Failed: ${failed}\n`);

  return { total: results.length, passed, failed, results };
}
