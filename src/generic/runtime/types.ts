export interface SnapshotEntry {
  path: string;
  type: 'file' | 'directory';
  mode: number;
  hash?: string;
}
export interface WorkspaceSnapshot {
  version: 1;
  root: string;
  artifactDir: string;
  snapshotFile: string;
  rootIdentity: { dev: number; ino: number };
  entries: SnapshotEntry[];
  boundary?: BoundaryOptions;
}
export interface RestorationEvidence { matches: boolean; differences: string[]; changedFiles?: string[] }
import type { BoundaryOptions } from '../boundary.js';

