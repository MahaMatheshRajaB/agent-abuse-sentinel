export type ActiveTab = 'overview' | 'models' | 'adversarial' | 'logs';

export interface AnomalyItem {
  id: string;
  timestamp: string;
  signature: string;
  severity: 'CRITICAL' | 'ELEVATED' | 'LOW';
  sourceIp: string;
  detectedBy: string;
  details: string;
}

export interface ValidationLogRow {
  id: string;
  timestamp: string;
  testVector: string;
  detectionMethod: string;
  confidence: number;
  status: 'DETECTED' | 'MARGINAL' | 'BYPASSED';
}

export interface ModelItem {
  id: string;
  name: string;
  version: string;
  status: 'ACTIVE' | 'CALIBRATING' | 'STANDBY';
  type: string;
  neuralLoad: number;
  recallRate: number;
  node: string;
  entropyWeight: number;
  lastTrained: string;
}

export interface TelemetryMetrics {
  resilienceScore: number;
  threatLevel: 'Nominal' | 'Elevated' | 'Critical';
  neuralLoad: number;
  entropyLatencyMs: number;
  avgNetworkLatencyMs: number;
  regionalLatencies: {
    region: string;
    code: string;
    latencyMs: number;
    elevated?: boolean;
  }[];
}
