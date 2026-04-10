export type TrackKey = 'Q1' | 'Q2';
export type TaskKey = 'task1' | 'task2' | 'task3' | 'task4';
export type AbilityKey = 'ability1' | 'ability2' | 'ability3' | 'ability4' | 'ability5';
export type EvaluationMode = 'judge_visible' | 'blind_human_scoring';

export interface UploadedFileIndex {
  rootName: string;
  datasetFingerprint: string;
  filesByRelativePath: Map<string, File>;
  allRelativePaths: string[];
}

export interface RunSummaryTask {
  task: string;
  pool_size?: number;
  benchmark_sample_count?: number;
  judge_sample_count?: number;
}

export interface ManualCheckRunSummary {
  seed?: string;
  config_path?: string;
  output_root?: string;
  generated_at?: string;
  tasks?: RunSummaryTask[];
}

export interface ManualCheckManifestRow {
  canonical_id: string;
  session_id: string;
  stratum?: string | null;
  assigned_model?: string | null;
  assigned_model_for_judge_track?: string | null;
  [key: string]: unknown;
}

export interface ManualCheckDatasetEntry {
  id: string;
  track: TrackKey;
  task: TaskKey;
  ability?: AbilityKey;
  manifestPath: string;
  baseDir: string;
  title: string;
  manifestRows: ManualCheckManifestRow[];
  itemCount: number;
}

export interface ManualCheckDataset {
  sourceType: 'manual_check_data_folder' | 'session_packet_folder' | 'merged_manual_check_bundle';
  rootName: string;
  datasetFingerprint: string;
  uploadedFileIndex?: UploadedFileIndex;
  bundledItemsByRelativePath?: Map<string, Record<string, unknown>>;
  sessionPacketBaseDir?: string;
  runSummary?: ManualCheckRunSummary;
  entries: ManualCheckDatasetEntry[];
  warnings: string[];
}

export interface LoadedManualCheckItem {
  entry: ManualCheckDatasetEntry;
  manifestRow: ManualCheckManifestRow;
  itemPath: string;
  itemData: Record<string, unknown>;
}

export interface TaskRequirementConfig {
  title: string;
  objective: string;
  whatToReview: string[];
  judgingCriteria: string[];
  checklist: string[];
  outputExpectation: string[];
}

export type OverallVerdict = 'reasonable' | 'partially_reasonable' | 'unreasonable';
export type TernaryAnswer = 'yes' | 'partial' | 'no';
export type BinaryAnswer = 'yes' | 'no';
export type AlignmentVerdict = 'aligned' | 'partially_aligned' | 'not_aligned';
export type UsedMemoryJudgment = 'used' | 'not_used' | 'uncertain';
export type ExpectedAction = 'retention' | 'addition' | 'modification';
export type ReviewHumanVerdict = 'supported' | 'partially_supported' | 'not_supported';
export type RelevanceLevel = 'strong' | 'medium' | 'weak' | 'irrelevant';
export type DependencyLevel = 'strong' | 'medium' | 'weak';
export type PurityLevel = 'high' | 'medium' | 'low';

export interface CommonAnnotationFields {
  status: 'draft' | 'saved';
  updatedAt: string;
  evidenceNote?: string;
  revisionSuggestion?: string;
  annotatorNote?: string;
}

export interface Q1Task1Annotation extends CommonAnnotationFields {
  formType: 'Q1:task1';
  overallVerdict: OverallVerdict | '';
  hasDialogueEvidence: TernaryAnswer | '';
  overInference: BinaryAnswer | '';
  faithfulToOriginalMeaning: TernaryAnswer | '';
  editableGoldMemories?: Array<Record<string, unknown>>;
  issueTypes: string[];
}

export interface Q1Task2Annotation extends CommonAnnotationFields {
  formType: 'Q1:task2';
  overallVerdict: OverallVerdict | '';
  expectedAction: ExpectedAction | '';
  newDialogueContainsUpdateSignal: TernaryAnswer | '';
  goldUpdateReasonable: TernaryAnswer | '';
  changedOnlyRelevantMemory: BinaryAnswer | '';
  editableNewDialogue: Array<{
    turnId: string;
    role: string;
    text: string;
  }>;
  editableUpdatedMemories: Array<Record<string, unknown>>;
  issueTypes: string[];
}

export interface Q1Task3Annotation extends CommonAnnotationFields {
  formType: 'Q1:task3';
  queryText: string;
  editableSelectedMemory?: Record<string, unknown> | null;
  relevanceLevel: RelevanceLevel | '';
  hardWithoutTargetMemory: TernaryAnswer | '';
  answerableByCommonSense: BinaryAnswer | '';
  multipleMemoriesCouldSupport: BinaryAnswer | '';
}

export interface Q1Task4SubAnnotation {
  queryId: string;
  queryText: string;
  ability?: AbilityKey;
  task4RecordIndex?: number;
  editableSelectedMemory?: Record<string, unknown> | null;
  overallVerdict: OverallVerdict | '';
  testsTargetAbility: TernaryAnswer | '';
  memoryDependency: DependencyLevel | '';
  abilityPurity: PurityLevel | '';
  issueTypes: string[];
  evidenceNote: string;
  revisionSuggestion: string;
}

export interface Q1Task4Annotation extends CommonAnnotationFields {
  formType: 'Q1:task4';
  ability?: AbilityKey;
  editableSelectedMemory?: Record<string, unknown> | null;
  subAnnotations: Q1Task4SubAnnotation[];
}

export interface Q2Task1ReviewItemAnnotation {
  reviewKind: 'pair_reviews' | 'missing_reviews' | 'extra_reviews';
  reviewId: string;
  humanVerdict: ReviewHumanVerdict | '';
  note: string;
  suggestedCorrection: string;
}

export interface Q2Task1VisibleModeAnnotation extends CommonAnnotationFields {
  mode: 'judge_visible';
  alignmentVerdict: AlignmentVerdict | '';
  issueTypes: string[];
  reviewItemAnnotations: Q2Task1ReviewItemAnnotation[];
}

export interface Q2Task1BlindModeAnnotation extends CommonAnnotationFields {
  mode: 'blind_human_scoring';
  humanScore: number | null;
  humanRationale: string;
}

export interface Q2Task1AnnotationRecord {
  formType: 'Q2:task1';
  status: 'draft' | 'saved';
  updatedAt: string;
  annotationsByMode: {
    judge_visible?: Q2Task1VisibleModeAnnotation;
    blind_human_scoring?: Q2Task1BlindModeAnnotation;
  };
}

export interface Q2Task2ReviewItemAnnotation {
  reviewKind: 'pair_reviews' | 'missing_reviews' | 'extra_reviews';
  reviewId: string;
  humanVerdict: ReviewHumanVerdict | '';
  note: string;
  suggestedCorrection: string;
}

export interface Q2Task2VisibleModeAnnotation extends CommonAnnotationFields {
  mode: 'judge_visible';
  alignmentVerdict: AlignmentVerdict | '';
  issueTypes: string[];
  reviewItemAnnotations: Q2Task2ReviewItemAnnotation[];
}

export interface Q2Task2BlindModeAnnotation extends CommonAnnotationFields {
  mode: 'blind_human_scoring';
  humanScore: number | null;
  humanRationale: string;
}

export interface Q2Task2AnnotationRecord {
  formType: 'Q2:task2';
  status: 'draft' | 'saved';
  updatedAt: string;
  annotationsByMode: {
    judge_visible?: Q2Task2VisibleModeAnnotation;
    blind_human_scoring?: Q2Task2BlindModeAnnotation;
  };
}

export interface Q2Task3VisibleModeAnnotation extends CommonAnnotationFields {
  mode: 'judge_visible';
  alignmentVerdict: AlignmentVerdict | '';
  usedMemoryCorrect: BinaryAnswer | '';
  scoreReasonable: TernaryAnswer | '';
  reasonSupportsJudgment: TernaryAnswer | '';
  scoreConsistentWithUsedMemory: BinaryAnswer | '';
  issueTypes: string[];
}

export interface Q2Task3BlindModeAnnotation extends CommonAnnotationFields {
  mode: 'blind_human_scoring';
  humanScore: number | null;
  usedMemoryHumanJudgment: UsedMemoryJudgment | '';
  humanRationale: string;
}

export interface Q2Task3AnnotationRecord {
  formType: 'Q2:task3';
  status: 'draft' | 'saved';
  updatedAt: string;
  annotationsByMode: {
    judge_visible?: Q2Task3VisibleModeAnnotation;
    blind_human_scoring?: Q2Task3BlindModeAnnotation;
  };
}

export interface Q2Task4VisibleModeAnnotation extends CommonAnnotationFields {
  mode: 'judge_visible';
  alignmentVerdict: AlignmentVerdict | '';
  issueTypes: string[];
}

export interface Q2Task4BlindModeAnnotation extends CommonAnnotationFields {
  mode: 'blind_human_scoring';
  humanScore: number | null;
  humanRationale: string;
  dimensionScores?: Record<string, number | null>;
}

export interface Q2Task4SubAnnotation {
  queryId: string;
  queryText: string;
  responseText: string;
  annotationsByMode: {
    judge_visible?: Q2Task4VisibleModeAnnotation;
    blind_human_scoring?: Q2Task4BlindModeAnnotation;
  };
}

export interface Q2Task4AnnotationRecord {
  formType: 'Q2:task4';
  status: 'draft' | 'saved';
  updatedAt: string;
  ability?: AbilityKey;
  subAnnotations: Q2Task4SubAnnotation[];
  annotatorNote?: string;
}

export type AnySupportedAnnotation =
  | Q1Task1Annotation
  | Q1Task2Annotation
  | Q1Task3Annotation
  | Q1Task4Annotation
  | Q2Task1AnnotationRecord
  | Q2Task2AnnotationRecord
  | Q2Task3AnnotationRecord
  | Q2Task4AnnotationRecord;

export interface SavedAnnotationEntry {
  draftKey: string;
  relativeItemPath: string;
  canonicalId: string;
  sessionId: string;
  track: TrackKey;
  task: TaskKey;
  ability?: AbilityKey;
  annotation: AnySupportedAnnotation;
}

export interface AnnotationExportBundle {
  bundleType: 'q1-q2-annotations';
  version: 1;
  sourceType: 'saved_annotation_bundle' | 'draft_annotation_bundle';
  rootName: string;
  datasetFingerprint: string;
  generatedAt: string;
  annotationStatus: 'saved' | 'draft';
  annotations: SavedAnnotationEntry[];
}

export interface MergedDatasetBundleItem {
  relativeItemPath: string;
  manifestRow: ManualCheckManifestRow;
  itemData: Record<string, unknown>;
  annotation?: AnySupportedAnnotation;
}

export interface MergedDatasetBundleEntry {
  id: string;
  track: TrackKey;
  task: TaskKey;
  ability?: AbilityKey;
  manifestPath: string;
  baseDir: string;
  title: string;
  itemCount: number;
  items: MergedDatasetBundleItem[];
}

export interface MergedDatasetExportBundle {
  bundleType: 'q1-q2-merged-dataset';
  version: 1;
  sourceType: 'merged_manual_check_bundle';
  rootName: string;
  datasetFingerprint: string;
  generatedAt: string;
  runSummary?: ManualCheckRunSummary;
  warnings: string[];
  entries: MergedDatasetBundleEntry[];
  annotations: SavedAnnotationEntry[];
}

export type ImportableBundle = AnnotationExportBundle | MergedDatasetExportBundle;
