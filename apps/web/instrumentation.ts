export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { SimpleSpanProcessor } = await import('@opentelemetry/sdk-trace-node');
    const { resourceFromAttributes } = await import('@opentelemetry/resources');

    const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        'service.name': 'kitchen-web',
        'service.version': '1.0.0',
      }),
      spanProcessor: new SimpleSpanProcessor(
        new OTLPTraceExporter({
          url: otelEndpoint,
        })
      ),
    });

    try {
      sdk.start();
    } catch {
      // OTel is optional — silently ignore if unavailable
    }
  }
}
