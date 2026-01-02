/**
 * Test Setup
 *
 * 테스트 환경 설정
 */

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// 각 테스트 후 자동 cleanup
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
