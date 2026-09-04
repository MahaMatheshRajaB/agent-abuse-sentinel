import { AnomalyItem, ModelItem, TelemetryMetrics } from '../types';

export const INITIAL_TELEMETRY: TelemetryMetrics = {
  resilienceScore: 96.73,
  threatLevel: 'Nominal',
  neuralLoad: 0,
  entropyLatencyMs: 0,
  avgNetworkLatencyMs: 0,
  regionalLatencies: [],
};

export const INITIAL_VALIDATION_LOGS: any[] = [];

export const INITIAL_ANOMALIES: AnomalyItem[] = [
  {
    id: '41d4478e-1f88-44e2-a96d-22959fcd6241',
    timestamp: '2026-09-04 22:15:00',
    signature: 'CATALOG SCRAPER (HIGH_CONFIDENCE)',
    severity: 'CRITICAL',
    sourceIp: 'Session 41d4478e',
    detectedBy: 'Hybrid Engine (Rule: 7/9, ML: 99.9%)',
    details: 'Unusually high request volume (136 > 51) | Requests fired too fast on average (2.60s < 5.15s) | High failure rate (18% > 15%)',
  },
  {
    id: 'c9274ed4-e01e-4d84-9eb4-87ffa9003d7d',
    timestamp: '2026-09-04 22:12:00',
    signature: 'PROMO ABUSE (HIGH_CONFIDENCE)',
    severity: 'CRITICAL',
    sourceIp: 'Session c9274ed4',
    detectedBy: 'Hybrid Engine (Rule: 6/9, ML: 99.8%)',
    details: 'Excessive discount code attempts (17 > 2) | High parameter reuse (0.32 > 0.19) | Fast request cadence',
  },
  {
    id: '24a0083a-e0c5-4db4-a958-308b4e0dbe45',
    timestamp: '2026-09-04 22:09:00',
    signature: 'CARD TESTING (HIGH_CONFIDENCE)',
    severity: 'CRITICAL',
    sourceIp: 'Session 24a0083a',
    detectedBy: 'Hybrid Engine (Rule: 8/9, ML: 100.0%)',
    details: 'High request volume (346 > 51) | High parameter reuse (85% > 19%) | High failure rate (31% > 15%)',
  },
  {
    id: '90c91ebe-27a9-4035-a37c-34c380f63e13',
    timestamp: '2026-09-04 22:06:00',
    signature: 'AI SHOPPING AGENT (REVIEW_QUEUE)',
    severity: 'ELEVATED',
    sourceIp: 'Session 90c91ebe',
    detectedBy: 'Hybrid Engine (Rule: 3/9, ML: 12.4%)',
    details: 'Fast API queries (2.84s mean IRT) | Param reuse (17.2%) | Headless agent without mouse movement routed to review queue to prevent auto-block',
  },
  {
    id: '1c04b4cf-7de8-4e7e-91ef-d94b2b3c2465',
    timestamp: '2026-09-04 22:03:00',
    signature: 'POWER USER (PASS)',
    severity: 'LOW',
    sourceIp: 'Session 1c04b4cf',
    detectedBy: 'Hybrid Engine (Rule: 1/9, ML: 0.2%)',
    details: 'Clean power user human session -- allowed through seamlessly',
  },
];

export const INITIAL_MODELS: ModelItem[] = [
  {
    id: 'mod-1',
    name: 'LightGBM Classifier',
    version: 'models/lgbm_model.pkl',
    status: 'ACTIVE',
    type: 'Gradient-boosted decision tree classifier',
    neuralLoad: 0,
    recallRate: 98.67,
    node: 'models/lgbm_model.pkl',
    entropyWeight: 95,
    lastTrained: 'sessions_train.csv (700 rows)',
  },
  {
    id: 'mod-2',
    name: 'Rule-Based Scorer',
    version: 'models/rule_thresholds.json',
    status: 'ACTIVE',
    type: 'Deterministic threshold rule engine',
    neuralLoad: 0,
    recallRate: 93.33,
    node: 'models/rule_thresholds.json',
    entropyWeight: 75,
    lastTrained: 'sessions_train.csv (midpoint logic)',
  },
];
