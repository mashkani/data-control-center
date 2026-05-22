import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDatasetProfile } from '@/hooks/useDatasetProfile'
import { mkProfile } from '@/test/profileFixtures'

const h = vi.hoisted(() => ({
  fetchDatasetProfile: vi.fn(),
  getJob: vi.fn(),
  refreshProfile: vi.fn(),
  cancelJob: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: {
    fetchDatasetProfile: h.fetchDatasetProfile,
    getJob: h.getJob,
    refreshProfile: h.refreshProfile,
    cancelJob: h.cancelJob,
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useDatasetProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.fetchDatasetProfile.mockResolvedValue(mkProfile())
    h.getJob.mockResolvedValue({ job_id: 'j1', status: 'completed', kind: 'profile_refresh' })
    h.refreshProfile.mockResolvedValue({ job_id: 'j2', status: 'queued' })
  })

  it('loads profile for dataset id', async () => {
    const { result } = renderHook(() => useDatasetProfile('ds_1'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(h.fetchDatasetProfile).toHaveBeenCalledWith(
      'ds_1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('refresh queues job', async () => {
    const { result } = renderHook(() => useDatasetProfile('ds_1'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    result.current.refresh()
    expect(h.refreshProfile).toHaveBeenCalledWith('ds_1')
  })

  it('invalidates profile caches when the refresh job completes', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateQueries = vi.spyOn(qc, 'invalidateQueries')
    const localWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )

    h.refreshProfile.mockResolvedValue({ job_id: 'j-refresh', status: 'queued' })
    h.getJob.mockResolvedValue({ job_id: 'j-refresh', status: 'completed', kind: 'profile_refresh' })

    const { result } = renderHook(() => useDatasetProfile('ds_1'), { wrapper: localWrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    result.current.refresh()

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['profile', 'ds_1'] })
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['datasets'] })
    })
  })

  it('clears the refresh job when it fails', async () => {
    h.refreshProfile.mockResolvedValue({ job_id: 'j-fail', status: 'queued' })
    h.getJob.mockResolvedValue({ job_id: 'j-fail', status: 'failed', kind: 'profile_refresh' })

    const { result } = renderHook(() => useDatasetProfile('ds_1'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    result.current.refresh()

    await waitFor(() => expect(h.getJob).toHaveBeenCalled())
  })

  it('cancelRefresh calls cancelJob for the active job', async () => {
    h.refreshProfile.mockResolvedValue({ job_id: 'j-cancel', status: 'queued' })
    h.getJob.mockResolvedValue({ job_id: 'j-cancel', status: 'running', kind: 'profile_refresh' })

    const { result } = renderHook(() => useDatasetProfile('ds_1'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    result.current.refresh()
    await waitFor(() => expect(result.current.runningRefresh).toBe(true))

    result.current.cancelRefresh()
    expect(h.cancelJob).toHaveBeenCalledWith('j-cancel')
  })
})
