import React, { useState } from 'react';
import { ModelItem } from '../types';

interface ModelsViewProps {
  models: ModelItem[];
  onToggleModelStatus: (id: string) => void;
  searchQuery?: string;
}

export const ModelsView: React.FC<ModelsViewProps> = ({
  models,
  onToggleModelStatus,
  searchQuery = '',
}) => {
  const [selectedModelId, setSelectedModelId] = useState<string>('mod-1');

  const filteredModels = models.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.node.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeModel = models.find((m) => m.id === selectedModelId) || models[0];

  return (
    <main id="models-canvas" className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-[1440px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono-label text-xs text-tertiary uppercase tracking-wider">
                DETECTION_ENGINE_CLUSTER
              </span>
              <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono-label text-xs">
                2 DETECTORS ONLINE
              </span>
            </div>
            <h2 className="font-display-lg text-[28px] md:text-[36px] font-bold text-on-surface">
              Trained Security Detection Models
            </h2>
            <p className="font-body-md text-on-surface-variant text-sm max-w-2xl">
              Dual rule-based and LightGBM classification models trained on sessions_train.csv and evaluated on sessions_holdout.csv.
            </p>
          </div>
        </div>

        {/* Model Cards Grid (2 cols) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredModels.map((model) => {
            const isSelected = model.id === selectedModelId;
            return (
              <div
                key={model.id}
                onClick={() => setSelectedModelId(model.id)}
                className={`glass-panel rounded-lg p-5 flex flex-col justify-between cursor-pointer transition-all border ${
                  isSelected
                    ? 'border-primary ring-1 ring-primary shadow-sm bg-surface-container-lowest'
                    : 'border-outline hover:border-on-surface-variant/40'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-headline-sm text-base font-bold text-on-surface">
                        {model.name}
                      </h3>
                      <p className="font-mono-label text-[11px] text-on-surface-variant">
                        {model.version}
                      </p>
                    </div>
                    <span
                      className={`font-mono-label text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                        model.status === 'ACTIVE'
                          ? 'bg-primary-container/20 text-primary border border-primary/20'
                          : 'bg-surface-variant text-on-surface-variant border border-outline'
                      }`}
                    >
                      {model.status}
                    </span>
                  </div>

                  <p className="font-body-sm text-xs text-on-surface-variant mb-4 font-medium">
                    {model.type}
                  </p>

                  <div className="space-y-2 border-t border-outline/50 pt-3 text-xs font-mono-data">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Artifact File:</span>
                      <span className="text-on-surface font-semibold">{model.node}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Holdout Precision:</span>
                      <span className="text-on-surface font-bold">
                        {model.id === 'mod-1' ? '94.87%' : '74.47%'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Holdout Recall Rate:</span>
                      <span className="text-primary font-bold">{model.recallRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Holdout F1 Score:</span>
                      <span className="text-primary font-bold">
                        {model.id === 'mod-1' ? '0.9673' : '0.8284'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">False Positive Rate:</span>
                      <span className="text-on-surface font-bold">
                        {model.id === 'mod-1' ? '1.78%' : '10.67%'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-outline/50 flex justify-between items-center text-[11px] font-mono-label">
                  <span className="text-on-surface-variant">Train Script: train_sentinel.py</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleModelStatus(model.id);
                    }}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    Toggle Status
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Inspection Panel */}
        {activeModel && (
          <div className="glass-panel rounded-lg p-6 space-y-4 shadow-xs">
            <div className="flex justify-between items-center border-b border-outline pb-3">
              <div>
                <span className="font-mono-label text-xs text-primary font-bold uppercase">
                  MODEL TECHNICAL METADATA
                </span>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                  {activeModel.name} ({activeModel.version})
                </h3>
              </div>
              <span className="font-mono-label text-xs text-on-surface-variant">
                Evaluated: sessions_holdout.csv
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-data">
              <div className="bg-surface-container-low p-4 rounded border border-outline space-y-2">
                <span className="text-on-surface-variant font-bold block mb-1">
                  ARCHITECTURE & PURPOSE
                </span>
                <p className="text-on-surface leading-relaxed font-sans text-xs">
                  {activeModel.id === 'mod-1'
                    ? 'Gradient-boosted decision tree trained on 17 extracted telemetry features from sessions_train.csv. Output probability is thresholded at 0.10 for high recall.'
                    : 'Deterministic rule engine finding optimal midpoints across 9 key telemetry features on training data. Assigns scores from 0 to 9; flags sessions at score >= 5.'}
                </p>
              </div>

              <div className="bg-surface-container-low p-4 rounded border border-outline space-y-2">
                <span className="text-on-surface-variant font-bold block mb-1">
                  HOLDOUT BENCHMARK METRICS
                </span>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Target Recall:</span>
                    <span className="text-primary font-bold">{activeModel.recallRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Precision:</span>
                    <span className="font-bold">
                      {activeModel.id === 'mod-1' ? '94.87%' : '74.47%'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>F1 Score:</span>
                    <span className="text-primary font-bold">
                      {activeModel.id === 'mod-1' ? '0.9673' : '0.8284'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
