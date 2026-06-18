import { describe, it, expect } from 'vitest';
import { isSafeUrl } from './validation.js';

describe('SSRF Protection — isSafeUrl', () => {
  it('allows public HTTPS URLs', () => {
    expect(isSafeUrl('https://example.com/webhook')).toBe(true);
    expect(isSafeUrl('https://api.stripe.com/webhook')).toBe(true);
    expect(isSafeUrl('https://hooks.slack.com/T00/B00/xxx')).toBe(true);
  });

  it('allows public HTTP URLs', () => {
    expect(isSafeUrl('http://example.com/webhook')).toBe(true);
  });

  it('blocks localhost', () => {
    expect(isSafeUrl('http://localhost:3001/api')).toBe(false);
    expect(isSafeUrl('https://localhost/webhook')).toBe(false);
  });

  it('blocks private IP ranges — 127.x.x.x', () => {
    expect(isSafeUrl('http://127.0.0.1:3001/api')).toBe(false);
    expect(isSafeUrl('http://127.0.0.2/admin')).toBe(false);
  });

  it('blocks private IP ranges — 10.x.x.x', () => {
    expect(isSafeUrl('http://10.0.0.1:3001/api')).toBe(false);
    expect(isSafeUrl('http://10.255.255.255/webhook')).toBe(false);
  });

  it('blocks private IP ranges — 172.16-31.x.x', () => {
    expect(isSafeUrl('http://172.16.0.1:3001/api')).toBe(false);
    expect(isSafeUrl('http://172.31.255.255/webhook')).toBe(false);
  });

  it('blocks private IP ranges — 192.168.x.x', () => {
    expect(isSafeUrl('http://192.168.1.1:3001/api')).toBe(false);
    expect(isSafeUrl('http://192.168.0.0/webhook')).toBe(false);
  });

  it('blocks link-local — 169.254.x.x', () => {
    expect(isSafeUrl('http://169.254.1.1/metadata')).toBe(false);
  });

  it('blocks IPv6 loopback', () => {
    expect(isSafeUrl('http://[::1]/webhook')).toBe(false);
  });

  it('blocks non-http protocols', () => {
    expect(isSafeUrl('ftp://example.com/file')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('blocks .local hostnames', () => {
    expect(isSafeUrl('http://myapp.local/webhook')).toBe(false);
  });

  it('blocks .internal hostnames', () => {
    expect(isSafeUrl('http://service.internal/api')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isSafeUrl('not-a-url')).toBe(false);
    expect(isSafeUrl('')).toBe(false);
  });
});
