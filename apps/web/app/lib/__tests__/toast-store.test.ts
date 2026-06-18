import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useToastStore, toast } from '../toast-store';

describe('toast-store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.getState().clearAll();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a toast and returns an ID', () => {
    const id = useToastStore.getState().addToast({ type: 'success', title: 'Done' });
    expect(id).toMatch(/^toast_/);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].title).toBe('Done');
    expect(useToastStore.getState().toasts[0].type).toBe('success');
  });

  it('auto-removes toast after duration', () => {
    useToastStore.getState().addToast({ type: 'info', title: 'Info', duration: 1000 });
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('removes toast manually', () => {
    const id = useToastStore.getState().addToast({ type: 'error', title: 'Error' });
    expect(useToastStore.getState().toasts).toHaveLength(1);

    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('clears all toasts', () => {
    useToastStore.getState().addToast({ type: 'success', title: 'A' });
    useToastStore.getState().addToast({ type: 'error', title: 'B' });
    expect(useToastStore.getState().toasts).toHaveLength(2);

    useToastStore.getState().clearAll();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('keeps max 5 toasts', () => {
    for (let i = 0; i < 7; i++) {
      useToastStore.getState().addToast({ type: 'info', title: `Toast ${i}` });
    }
    expect(useToastStore.getState().toasts).toHaveLength(5);
    // Oldest should be dropped
    expect(useToastStore.getState().toasts[0].title).toBe('Toast 2');
  });

  it('convenience helpers work', () => {
    toast.success('Done', 'Details');
    toast.error('Failed', 'Reason');
    toast.warning('Watch out');
    toast.info('FYI');

    expect(useToastStore.getState().toasts).toHaveLength(4);
    expect(useToastStore.getState().toasts[0].type).toBe('success');
    expect(useToastStore.getState().toasts[1].type).toBe('error');
    expect(useToastStore.getState().toasts[2].type).toBe('warning');
    expect(useToastStore.getState().toasts[3].type).toBe('info');
  });

  it('default duration for error is 6000ms', () => {
    useToastStore.getState().addToast({ type: 'error', title: 'Error' });
    vi.advanceTimersByTime(5999);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('default duration for non-error is 4000ms', () => {
    useToastStore.getState().addToast({ type: 'success', title: 'OK' });
    vi.advanceTimersByTime(3999);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('duration=0 prevents auto-removal', () => {
    useToastStore.getState().addToast({ type: 'info', title: 'Persistent', duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });
});
