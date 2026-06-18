import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;

export function initTracing() {
  if (sdk) return;

  const collectorUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_COLLECTOR_URL;
  const isProduction = process.env.NODE_ENV === 'production';

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'kitchen-api',
    [ATTR_SERVICE_VERSION]: '1.0.0',
    'deployment.environment': isProduction ? 'production' : 'development',
  });

  const sdkConfig: any = {
    resource,
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-pg': { enabled: false },
    })],
  };

  if (collectorUrl) {
    sdkConfig.traceExporter = new OTLPTraceExporter({
      url: `${collectorUrl}/v1/traces`,
    });
  }

  sdk = new NodeSDK(sdkConfig);
  sdk.start();

  const shutdown = () => sdk?.shutdown().catch(() => {});
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
