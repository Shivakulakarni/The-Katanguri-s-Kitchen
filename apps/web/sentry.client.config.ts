import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = {
  experimental: {},
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT_WEB || 'kitchen-web',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: { disable: true },
  disableLogger: true,
  tunnelRoute: '/api/sentry-tunnel',
});
