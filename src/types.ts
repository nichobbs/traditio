export type Agent = 'wolf' | 'bird' | 'child' | 'stone' | 'river';
export type Action = 'sees' | 'chases' | 'eats' | 'fears' | 'finds';
export type Tense = 'past' | 'nonpast';

export interface Meaning {
  id: string;
  agent: Agent;
  action: Action;
  patient: Agent;
  tense: Tense;
}

export interface LanguagePair {
  meaningId: string;
  form: string;
}

export interface Language {
  pairs: LanguagePair[];
}

export interface TrainingSample {
  pairs: LanguagePair[];
  meanings: Meaning[];
}

export interface ExperimentConfig {
  seed: number;
  bottleneck: {
    sampleFraction: number;
    maxTrainingTokens: number;
  };
  model: string;
  maxOutputTokens: number;
  temperature: number;
}

export interface GenerationMeta {
  generationNumber: number;
  model: string;
  timestamp: string;
  configHash: string;
  promptHash: string;
}

export interface Metrics {
  transmissionFidelity: {
    overall: {
      meanLevenshtein: number;
      exactMatchRate: number;
    };
    inSample: {
      meanLevenshtein: number;
      exactMatchRate: number;
    };
    heldOut: {
      meanLevenshtein: number;
      exactMatchRate: number;
    };
  };
  compositionality: {
    pearsonCorrelation: number;
  };
  compressibility: {
    compressionRatio: number;
  };
  lexiconStats: {
    uniqueFormCount: number;
    meanFormLength: number;
    characterBigramEntropy: number;
  };
}

export interface GenerationOutput {
  pairs: LanguagePair[];
  metrics: Metrics;
  meta: GenerationMeta;
}

export interface ApiClient {
  callLearner(prompt: string, config: ApiConfig): Promise<string>;
}

export interface ApiConfig {
  model: string;
  maxOutputTokens: number;
  temperature: number;
}
