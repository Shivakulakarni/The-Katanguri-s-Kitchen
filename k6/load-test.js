import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = 'http://localhost:3001/api/v1';

const errorRate = new Rate('errors');
const menuLatency = new Trend('menu_latency');
const orderLatency = new Trend('order_latency');

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '30s', target: 200 },
    { duration: '30s', target: 500 },
    { duration: '30s', target: 1000 },
    { duration: '30s', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
    menu_latency: ['p(95)<1000'],
  },
};

export default function () {
  group('Menu API', () => {
    const res = http.get(`${BASE_URL}/menu`);
    menuLatency.add(res.timings.duration);
    const ok = check(res, {
      'menu returns 200': (r) => r.status === 200,
      'menu has data': (r) => JSON.parse(r.body).length > 0,
    });
    errorRate.add(!ok);
    sleep(1);
  });

  group('Menu Categories', () => {
    const res = http.get(`${BASE_URL}/menu/categories`);
    check(res, {
      'categories returns 200': (r) => r.status === 200,
    });
    sleep(0.5);
  });

  group('Menu Dishes', () => {
    const res = http.get(`${BASE_URL}/menu/dishes`);
    check(res, {
      'dishes returns 200': (r) => r.status === 200,
    });
    sleep(0.5);
  });

  group('Health Check', () => {
    const res = http.get(`${BASE_URL.replace('/api/v1', '')}/api/v1/health`);
    check(res, {
      'health returns 200': (r) => r.status === 200,
    });
    sleep(0.3);
  });
}

export function handleSummary(data) {
  return {
    'k6/report.html': htmlReport(data),
    'k6/report.json': JSON.stringify(data),
  };
}

function htmlReport(data) {
  const metrics = data.metrics;
  return `<!DOCTYPE html>
<html><head><title>k6 Load Test Report</title>
<style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}
th{background:#f5f5f5}h2{margin-top:32px}</style></head><body>
<h1>k6 Load Test Report</h1>
<h2>Summary</h2>
<table>
<tr><th>Metric</th><th>Value</th></tr>
<tr><td>Total Requests</td><td>${data.state.testRunDuration || 'N/A'}</td></tr>
</table>
<h2>HTTP Metrics</h2>
<table>
<tr><th>Metric</th><th>Avg</th><th>Min</th><th>Med</th><th>p(90)</th><th>p(95)</th><th>Max</th></tr>
<tr>
  <td>http_req_duration</td>
  <td>${metrics.http_req_duration?.values?.avg?.toFixed(2) || 'N/A'}ms</td>
  <td>${metrics.http_req_duration?.values?.min?.toFixed(2) || 'N/A'}ms</td>
  <td>${metrics.http_req_duration?.values?.med?.toFixed(2) || 'N/A'}ms</td>
  <td>${metrics.http_req_duration?.values?.['p(90)']?.toFixed(2) || 'N/A'}ms</td>
  <td>${metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms</td>
  <td>${metrics.http_req_duration?.values?.max?.toFixed(2) || 'N/A'}ms</td>
</tr>
<tr>
  <td>menu_latency</td>
  <td>${metrics.menu_latency?.values?.avg?.toFixed(2) || 'N/A'}ms</td>
  <td>${metrics.menu_latency?.values?.min?.toFixed(2) || 'N/A'}ms</td>
  <td>${metrics.menu_latency?.values?.med?.toFixed(2) || 'N/A'}ms</td>
  <td>${metrics.menu_latency?.values?.['p(90)']?.toFixed(2) || 'N/A'}ms</td>
  <td>${metrics.menu_latency?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms</td>
  <td>${metrics.menu_latency?.values?.max?.toFixed(2) || 'N/A'}ms</td>
</tr>
</table>
<h2>Checks</h2>
<table>
<tr><th>Check</th><th>Passes</th><th>Fails</th><th>Rate</th></tr>
${Object.entries(data?.root_group?.groups || {}).map(([name, g]) => `
<tr><td>${name}</td><td>${g.checks?.[0]?.passes || 0}</td><td>${g.checks?.[0]?.fails || 0}</td><td>${((g.checks?.[0]?.passes || 0) / Math.max(g.checks?.[0]?.passes + g.checks?.[0]?.fails, 1) * 100).toFixed(1)}%</td></tr>
`).join('')}
</table>
</body></html>`;
}
