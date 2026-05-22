import { describe, expect, it, vi } from 'vitest'
import { appQueryClient } from '@/appQueryClient'
import { isTransientNetworkError } from '@/lib/transientNetworkError'

vi.mock('@/lib/transientNetworkError', () => ({
  isTransientNetworkError: vi.fn(),
}))

describe('appQueryClient', () => {
  const retry = appQueryClient.getDefaultOptions().queries?.retry as (
    failureCount: number,
    error: Error,
  ) => boolean

  it('retries transient network errors up to five times', () => {
    vi.mocked(isTransientNetworkError).mockReturnValue(true)
    expect(retry(4, new Error('socket hang up'))).toBe(true)
    expect(retry(5, new Error('socket hang up'))).toBe(false)
  })

  it('retries other errors up to three times', () => {
    vi.mocked(isTransientNetworkError).mockReturnValue(false)
    expect(retry(2, new Error('server error'))).toBe(true)
    expect(retry(3, new Error('server error'))).toBe(false)
  })
})
