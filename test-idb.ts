/**
 * Test file to verify idb installation and basic operations
 * This file can be deleted after verification
 */

import { openDB } from 'idb';

async function testIDB() {
  console.log('Testing idb installation...');

  try {
    // Test 1: Open a test database
    const db = await openDB('test-db', 1, {
      upgrade(db) {
        // Create a test object store
        if (!db.objectStoreNames.contains('test-store')) {
          db.createObjectStore('test-store', { keyPath: 'id' });
        }
      },
    });

    console.log('✓ Database opened successfully');

    // Test 2: Write operation
    await db.put('test-store', { id: 1, message: 'Hello from idb!' });
    console.log('✓ Write operation successful');

    // Test 3: Read operation
    const result = await db.get('test-store', 1);
    console.log('✓ Read operation successful:', result);

    // Test 4: Delete operation
    await db.delete('test-store', 1);
    console.log('✓ Delete operation successful');

    // Close the database
    db.close();
    console.log('✓ All tests passed! idb is working correctly.');

    return true;
  } catch (error) {
    console.error('✗ Test failed:', error);
    return false;
  }
}

// Export for potential use
export { testIDB };
