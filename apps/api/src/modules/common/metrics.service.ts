import { Injectable, Logger } from '@nestjs/common';

/**
 * Lightweight Prometheus-compatible metrics collector.
 *
 * Export format (Prometheus text):
 *   # TYPE <name> <type>
 *   <name>{<labels>} <value>
 *
 * Replace with prom-client library when adding histograms/quantiles.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private durations = new Map<string, number[]>();

  // ── Counters (monotonically increasing) ──────────────────────────

  incrementCounter(name: string, labels: Record<string, string> = {}): void {
    const key = this.encodeKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  // ── Gauges (can go up and down) ─────────────────────────────────

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    this.gauges.set(this.encodeKey(name, labels), value);
  }

  // ── Duration tracking (ms) ──────────────────────────────────────

  recordDuration(name: string, durationMs: number, labels: Record<string, string> = {}): void {
    const key = this.encodeKey(name, labels);
    if (!this.durations.has(key)) {
      this.durations.set(key, []);
    }
    this.durations.get(key)!.push(durationMs);
    // Keep only last 1000 samples per key to bound memory
    const arr = this.durations.get(key)!;
    if (arr.length > 1000) {
      arr.splice(0, arr.length - 1000);
    }
  }

  // ── Export (Prometheus text format) ─────────────────────────────

  export(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, value] of this.counters) {
      const { name, labels } = this.decodeKey(key);
      lines.push(`# TYPE ${name} counter`);
      if (labels) {
        lines.push(`${name}{${labels}} ${value}`);
      } else {
        lines.push(`${name} ${value}`);
      }
    }

    // Gauges
    for (const [key, value] of this.gauges) {
      const { name, labels } = this.decodeKey(key);
      lines.push(`# TYPE ${name} gauge`);
      if (labels) {
        lines.push(`${name}{${labels}} ${value}`);
      } else {
        lines.push(`${name} ${value}`);
      }
    }

    // Duration summaries (p50, p95, p99)
    for (const [key, samples] of this.durations) {
      if (samples.length === 0) continue;
      const { name, labels } = this.decodeKey(key);
      const sorted = [...samples].sort((a, b) => a - b);
      const labelStr = labels ? `${labels},` : '';

      lines.push(`# TYPE ${name}_p50 gauge`);
      lines.push(`${name}_p50{${labelStr}}percentile="50" ${percentile(sorted, 0.5)}`);
      lines.push(`# TYPE ${name}_p95 gauge`);
      lines.push(`${name}_p95{${labelStr}}percentile="95" ${percentile(sorted, 0.95)}`);
      lines.push(`# TYPE ${name}_p99 gauge`);
      lines.push(`${name}_p99{${labelStr}}percentile="99" ${percentile(sorted, 0.99)}`);
    }

    lines.push('# EOF');
    return lines.join('\n');
  }

  // ── Internal helpers ────────────────────────────────────────────

  private encodeKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}|${labelStr}`;
  }

  private decodeKey(key: string): { name: string; labels: string } {
    const pipeIdx = key.indexOf('|');
    if (pipeIdx === -1) return { name: key, labels: '' };
    return { name: key.slice(0, pipeIdx), labels: key.slice(pipeIdx + 1) };
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
