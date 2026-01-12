/**
 * Test suite for chunked upload utility.
 * These tests verify the chunked upload operations work correctly.
 *
 * To run manually in development, import and call runChunkedUploadTests()
 */

import * as FileSystem from "expo-file-system/legacy";
import {
  CHUNK_SIZE,
  MAX_CHUNK_RETRIES,
  shouldUseChunkedUpload,
} from "../chunked-upload";
import {
  saveUploadState,
  loadUploadState,
  removeUploadState,
  getAllUploadStates,
  cleanupStaleUploadStates,
  hasResumableUpload,
  getUploadProgress,
} from "../upload-state";
import type { MultipartUploadState } from "../chunked-upload";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

/**
 * Test that CHUNK_SIZE is 5MB as specified.
 */
function testChunkSize(): TestResult {
  const name = "CHUNK_SIZE is 5MB";
  try {
    const expectedSize = 5 * 1024 * 1024; // 5MB
    if (CHUNK_SIZE !== expectedSize) {
      return {
        name,
        passed: false,
        error: `Expected ${expectedSize}, got ${CHUNK_SIZE}`,
      };
    }
    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test that MAX_CHUNK_RETRIES is 3 as specified.
 */
function testMaxChunkRetries(): TestResult {
  const name = "MAX_CHUNK_RETRIES is 3";
  try {
    if (MAX_CHUNK_RETRIES !== 3) {
      return {
        name,
        passed: false,
        error: `Expected 3, got ${MAX_CHUNK_RETRIES}`,
      };
    }
    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test shouldUseChunkedUpload for various file sizes.
 */
function testShouldUseChunkedUpload(): TestResult {
  const name = "shouldUseChunkedUpload returns correct values";
  try {
    const testCases = [
      { size: 1 * 1024 * 1024, expected: false }, // 1MB - no chunking
      { size: 5 * 1024 * 1024, expected: false }, // 5MB - no chunking
      { size: 10 * 1024 * 1024, expected: false }, // 10MB - boundary
      { size: 10 * 1024 * 1024 + 1, expected: true }, // 10MB + 1 byte - chunking
      { size: 50 * 1024 * 1024, expected: true }, // 50MB - chunking
      { size: 100 * 1024 * 1024, expected: true }, // 100MB - chunking
    ];

    for (const { size, expected } of testCases) {
      const result = shouldUseChunkedUpload(size);
      if (result !== expected) {
        const sizeMB = (size / (1024 * 1024)).toFixed(2);
        return {
          name,
          passed: false,
          error: `For ${sizeMB}MB, expected ${expected}, got ${result}`,
        };
      }
    }

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test saving and loading upload state.
 */
async function testSaveAndLoadUploadState(): Promise<TestResult> {
  const name = "saveUploadState and loadUploadState work correctly";
  try {
    const testEntryId = "test-entry-save-load";
    const testState: MultipartUploadState = {
      uploadId: "test-upload-id",
      objectKey: "videos/user123/test-video.mp4",
      fileUri: "file:///test/video.mp4",
      fileSize: 50 * 1024 * 1024,
      contentType: "video/mp4",
      fileType: "video",
      totalChunks: 10,
      completedParts: [
        { partNumber: 1, etag: "etag-1" },
        { partNumber: 2, etag: "etag-2" },
      ],
      createdAt: new Date().toISOString(),
    };

    // Save state
    await saveUploadState(testEntryId, testState);

    // Load state
    const loadedState = await loadUploadState(testEntryId);

    if (!loadedState) {
      await removeUploadState(testEntryId);
      return { name, passed: false, error: "Failed to load saved state" };
    }

    if (loadedState.uploadId !== testState.uploadId) {
      await removeUploadState(testEntryId);
      return { name, passed: false, error: "uploadId mismatch" };
    }

    if (loadedState.objectKey !== testState.objectKey) {
      await removeUploadState(testEntryId);
      return { name, passed: false, error: "objectKey mismatch" };
    }

    if (loadedState.completedParts.length !== testState.completedParts.length) {
      await removeUploadState(testEntryId);
      return { name, passed: false, error: "completedParts length mismatch" };
    }

    // Clean up
    await removeUploadState(testEntryId);

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test removing upload state.
 */
async function testRemoveUploadState(): Promise<TestResult> {
  const name = "removeUploadState removes state correctly";
  try {
    const testEntryId = "test-entry-remove";
    const testState: MultipartUploadState = {
      uploadId: "test-upload-id-remove",
      objectKey: "videos/user123/remove-test.mp4",
      fileUri: "file:///test/remove.mp4",
      fileSize: 10 * 1024 * 1024,
      contentType: "video/mp4",
      fileType: "video",
      totalChunks: 2,
      completedParts: [],
      createdAt: new Date().toISOString(),
    };

    // Save state
    await saveUploadState(testEntryId, testState);

    // Verify it exists
    const beforeRemove = await loadUploadState(testEntryId);
    if (!beforeRemove) {
      return { name, passed: false, error: "State should exist before removal" };
    }

    // Remove state
    await removeUploadState(testEntryId);

    // Verify it's removed
    const afterRemove = await loadUploadState(testEntryId);
    if (afterRemove) {
      return { name, passed: false, error: "State should not exist after removal" };
    }

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test hasResumableUpload.
 */
async function testHasResumableUpload(): Promise<TestResult> {
  const name = "hasResumableUpload returns correct status";
  try {
    const testEntryId = "test-entry-resumable";
    const testState: MultipartUploadState = {
      uploadId: "test-upload-id-resumable",
      objectKey: "videos/user123/resumable-test.mp4",
      fileUri: "file:///test/resumable.mp4",
      fileSize: 30 * 1024 * 1024,
      contentType: "video/mp4",
      fileType: "video",
      totalChunks: 6,
      completedParts: [{ partNumber: 1, etag: "etag-1" }],
      createdAt: new Date().toISOString(),
    };

    // Before saving - should not be resumable
    const beforeSave = await hasResumableUpload(testEntryId);
    if (beforeSave) {
      return { name, passed: false, error: "Should not be resumable before save" };
    }

    // Save state
    await saveUploadState(testEntryId, testState);

    // After saving - should be resumable
    const afterSave = await hasResumableUpload(testEntryId);
    if (!afterSave) {
      await removeUploadState(testEntryId);
      return { name, passed: false, error: "Should be resumable after save" };
    }

    // Clean up
    await removeUploadState(testEntryId);

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test getUploadProgress.
 */
async function testGetUploadProgress(): Promise<TestResult> {
  const name = "getUploadProgress returns correct percentage";
  try {
    const testEntryId = "test-entry-progress";
    const testState: MultipartUploadState = {
      uploadId: "test-upload-id-progress",
      objectKey: "videos/user123/progress-test.mp4",
      fileUri: "file:///test/progress.mp4",
      fileSize: 50 * 1024 * 1024,
      contentType: "video/mp4",
      fileType: "video",
      totalChunks: 10,
      completedParts: [
        { partNumber: 1, etag: "etag-1" },
        { partNumber: 2, etag: "etag-2" },
        { partNumber: 3, etag: "etag-3" },
        { partNumber: 4, etag: "etag-4" },
        { partNumber: 5, etag: "etag-5" },
      ], // 5 out of 10 = 50%
      createdAt: new Date().toISOString(),
    };

    // No state - should return null
    const noStateProgress = await getUploadProgress(testEntryId);
    if (noStateProgress !== null) {
      return { name, passed: false, error: "Should return null for non-existent state" };
    }

    // Save state with 50% progress
    await saveUploadState(testEntryId, testState);

    const progress = await getUploadProgress(testEntryId);
    if (progress !== 50) {
      await removeUploadState(testEntryId);
      return { name, passed: false, error: `Expected 50%, got ${progress}%` };
    }

    // Clean up
    await removeUploadState(testEntryId);

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test getAllUploadStates.
 */
async function testGetAllUploadStates(): Promise<TestResult> {
  const name = "getAllUploadStates returns all pending states";
  try {
    // Get initial count
    const initialStates = await getAllUploadStates();
    const initialCount = initialStates.length;

    // Add test states
    const testEntryId1 = "test-all-states-1";
    const testEntryId2 = "test-all-states-2";

    const testState1: MultipartUploadState = {
      uploadId: "upload-1",
      objectKey: "videos/user123/all-1.mp4",
      fileUri: "file:///test/all-1.mp4",
      fileSize: 20 * 1024 * 1024,
      contentType: "video/mp4",
      fileType: "video",
      totalChunks: 4,
      completedParts: [],
      createdAt: new Date().toISOString(),
    };

    const testState2: MultipartUploadState = {
      uploadId: "upload-2",
      objectKey: "videos/user123/all-2.mp4",
      fileUri: "file:///test/all-2.mp4",
      fileSize: 30 * 1024 * 1024,
      contentType: "video/mp4",
      fileType: "video",
      totalChunks: 6,
      completedParts: [{ partNumber: 1, etag: "etag" }],
      createdAt: new Date().toISOString(),
    };

    await saveUploadState(testEntryId1, testState1);
    await saveUploadState(testEntryId2, testState2);

    // Get all states
    const allStates = await getAllUploadStates();

    if (allStates.length !== initialCount + 2) {
      await removeUploadState(testEntryId1);
      await removeUploadState(testEntryId2);
      return {
        name,
        passed: false,
        error: `Expected ${initialCount + 2} states, got ${allStates.length}`,
      };
    }

    // Clean up
    await removeUploadState(testEntryId1);
    await removeUploadState(testEntryId2);

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test stale state cleanup.
 */
async function testStaleStateCleanup(): Promise<TestResult> {
  const name = "stale upload states are properly handled";
  try {
    const testEntryId = "test-stale-state";

    // Create a state that appears to be from over 24 hours ago
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const staleState: MultipartUploadState = {
      uploadId: "stale-upload-id",
      objectKey: "videos/user123/stale.mp4",
      fileUri: "file:///test/stale.mp4",
      fileSize: 10 * 1024 * 1024,
      contentType: "video/mp4",
      fileType: "video",
      totalChunks: 2,
      completedParts: [],
      createdAt: staleDate,
    };

    await saveUploadState(testEntryId, staleState);

    // Loading stale state should return null and clean up
    const loaded = await loadUploadState(testEntryId);
    if (loaded !== null) {
      await removeUploadState(testEntryId);
      return { name, passed: false, error: "Stale state should return null" };
    }

    // Verify file was cleaned up
    const exists = await hasResumableUpload(testEntryId);
    if (exists) {
      await removeUploadState(testEntryId);
      return { name, passed: false, error: "Stale state file should be cleaned up" };
    }

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test chunk calculation for various file sizes.
 */
function testChunkCalculation(): TestResult {
  const name = "chunk calculation is correct for various file sizes";
  try {
    const testCases = [
      { size: 10 * 1024 * 1024, expectedChunks: 2 }, // 10MB
      { size: 50 * 1024 * 1024, expectedChunks: 10 }, // 50MB
      { size: 100 * 1024 * 1024, expectedChunks: 20 }, // 100MB
      { size: 5 * 1024 * 1024, expectedChunks: 1 }, // 5MB (exactly one chunk)
      { size: 5 * 1024 * 1024 + 1, expectedChunks: 2 }, // 5MB + 1 byte
      { size: 500 * 1024 * 1024, expectedChunks: 100 }, // 500MB (max allowed)
    ];

    for (const { size, expectedChunks } of testCases) {
      const calculatedChunks = Math.ceil(size / CHUNK_SIZE);
      if (calculatedChunks !== expectedChunks) {
        const sizeMB = (size / (1024 * 1024)).toFixed(2);
        return {
          name,
          passed: false,
          error: `For ${sizeMB}MB, expected ${expectedChunks} chunks, got ${calculatedChunks}`,
        };
      }
    }

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Test progress percentage calculation.
 */
function testProgressCalculation(): TestResult {
  const name = "progress percentage calculation is accurate";
  try {
    const testCases = [
      { completed: 0, total: 10, expected: 0 },
      { completed: 1, total: 10, expected: 10 },
      { completed: 5, total: 10, expected: 50 },
      { completed: 7, total: 10, expected: 70 },
      { completed: 10, total: 10, expected: 100 },
      { completed: 3, total: 20, expected: 15 },
      { completed: 17, total: 20, expected: 85 },
    ];

    for (const { completed, total, expected } of testCases) {
      const calculated = Math.round((completed / total) * 100);
      if (calculated !== expected) {
        return {
          name,
          passed: false,
          error: `For ${completed}/${total}, expected ${expected}%, got ${calculated}%`,
        };
      }
    }

    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

/**
 * Run all chunked upload tests.
 */
export async function runChunkedUploadTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  // Synchronous tests
  results.push(testChunkSize());
  results.push(testMaxChunkRetries());
  results.push(testShouldUseChunkedUpload());
  results.push(testChunkCalculation());
  results.push(testProgressCalculation());

  // Async tests
  results.push(await testSaveAndLoadUploadState());
  results.push(await testRemoveUploadState());
  results.push(await testHasResumableUpload());
  results.push(await testGetUploadProgress());
  results.push(await testGetAllUploadStates());
  results.push(await testStaleStateCleanup());

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  // Log results
  console.log("\n=== Chunked Upload Tests ===\n");
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
