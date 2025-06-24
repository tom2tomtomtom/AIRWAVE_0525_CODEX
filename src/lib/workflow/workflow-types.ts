// Shared types for the AIRWAVE workflow system

export enum WorkflowStep {
  BRIEF_UPLOAD = 0,
  MOTIVATION_SELECTION = 1,
  COPY_GENERATION = 2,
  ASSET_SELECTION = 3,
  TEMPLATE_SELECTION = 4,
  MATRIX_BUILD = 5,
  RENDERING = 6}

export interface WorkflowStepInfo {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

export interface BriefData {
  title: string;
  objective: string;
  targetAudience: string;
  keyMessages: string[];
  platforms: string[];
  budget: string;
  timeline: string;
  product?: string;
  service?: string;
  valueProposition?: string;
  brandGuidelines?: string;
  requirements?: string[];
  industry?: string;
  competitors?: string[];
}

export interface Motivation {
  id: string;
  title: string;
  description: string;
  score: number;
  selected: boolean;
}

export interface CopyVariation {
  id: string;
  text: string;
  platform: string;
  selected: boolean;
}

export interface Asset {
  id: string;
  type: 'image' | 'video' | 'copy' | 'template';
  url?: string;
  content?: string;
  metadata?: Record<string, any>;
  selected: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  category: string;
  selected: boolean;
}

export interface WorkflowState {
  // Current step
  currentStep: number;

  // Data for each step
  briefData: BriefData | null;
  originalBriefData: BriefData | null;
  motivations: Motivation[];
  copyVariations: CopyVariation[];
  selectedAssets: Asset[];
  selectedTemplate: Template | null;

  // UI state
  processing: boolean;
  uploadedFile: File | null;
  showBriefReview: boolean;
  briefConfirmed: boolean;
  lastError: string | null;

  // Client context
  clientId: string | null;
}

export interface WorkflowActions {
  // Navigation
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;

  // Brief handling
  uploadBrief: (file: File) => Promise<void>;
  confirmBrief: (briefData: BriefData) => void;
  resetBrief: () => void;

  // Motivations
  generateMotivations: () => Promise<void>;
  selectMotivation: (id: string) => void;

  // Copy generation
  generateCopy: () => Promise<void>;
  selectCopy: (id: string) => void;
  storeCopyVariations: (selectedCopy: CopyVariation[]) => Promise<any>;

  // Asset selection
  selectAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;

  // Template selection
  selectTemplate: (template: Template) => void;

  // Error handling
  clearError: () => void;
  setError: (error: string) => void;

  // Reset workflow
  resetWorkflow: () => void;
}

export interface WorkflowContext {
  state: WorkflowState;
  actions: WorkflowActions;
}

// Step component props interface
export interface StepComponentProps {
  onNext?: () => void;
  onPrevious?: () => void;
  onComplete?: (data: any) => void;
}

// Workflow events for XState machine
export type WorkflowEvent =
  | { type: 'UPLOAD_BRIEF'; file: File }
  | { type: 'CONFIRM_BRIEF'; briefData: BriefData }
  | { type: 'GENERATE_MOTIVATIONS' }
  | { type: 'SELECT_MOTIVATION'; id: string }
  | { type: 'GENERATE_COPY' }
  | { type: 'SELECT_COPY'; id: string }
  | { type: 'SELECT_ASSET'; asset: Asset }
  | { type: 'SELECT_TEMPLATE'; template: Template }
  | { type: 'NEXT_STEP' }
  | { type: 'PREVIOUS_STEP' }
  | { type: 'GO_TO_STEP'; step: number }
  | { type: 'RESET_WORKFLOW' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' };

// Workflow machine context
export interface WorkflowMachineContext {
  currentStep: number;
  briefData: BriefData | null;
  originalBriefData: BriefData | null;
  motivations: Motivation[];
  copyVariations: CopyVariation[];
  selectedAssets: Asset[];
  selectedTemplate: Template | null;
  processing: boolean;
  uploadedFile: File | null;
  showBriefReview: boolean;
  briefConfirmed: boolean;
  lastError: string | null;
  clientId: string | null;
}

// Cost control integration
export interface CostCheckRequest {
  service: 'openai' | 'anthropic' | 'elevenlabs';
  model: string;
  estimatedTokens: number;
  operation: string;
  operationData?: any;
}

export interface CostCheckResponse {
  allowed: boolean;
  reason?: string;
  fallbackModel?: string;
  budgetRemaining?: number;
  usageStats?: {
    percentOfBudget: number;
    totalSpent: number;
    monthlyLimit: number;
  };
}

// Utility functions for workflow types

/**
 * Type guard to check if an object is valid BriefData
 */
export function isValidBriefData(data: any): data is BriefData {
  if (!data || typeof data !== 'object') return false;

  const required = [
    'title',
    'objective',
    'targetAudience',
    'keyMessages',
    'platforms',
    'budget',
    'timeline',
  ];

  for (const field of required) {
    if (!data[field]) return false;
    if (typeof data[field] === 'string' && data[field].trim() === '') return false;
    if (Array.isArray(data[field]) && data[field].length === 0) return false;
  }

  return true;
}

/**
 * Type guard to check if an object is valid Motivation
 */
export function isValidMotivation(data: any): data is Motivation {
  if (!data || typeof data !== 'object') return false;

  return (
    typeof data.id === 'string' &&
    typeof data.title === 'string' &&
    typeof data.description === 'string' &&
    typeof data.score === 'number' &&
    data.score >= 0 &&
    data.score <= 1 &&
    typeof data.selected === 'boolean'
  );
}

/**
 * Type guard to check if an object is valid CopyVariation
 */
export function isValidCopyVariation(data: any): data is CopyVariation {
  if (!data || typeof data !== 'object') return false;

  return (
    typeof data.id === 'string' &&
    typeof data.text === 'string' &&
    data?.text?.trim() !== '' &&
    typeof data.platform === 'string' &&
    typeof data.selected === 'boolean'
  );
}

/**
 * Type guard to check if an object is valid Asset
 */
export function isValidAsset(data: any): data is Asset {
  if (!data || typeof data !== 'object') return false;

  const validTypes = ['image', 'video', 'copy', 'template'];

  return (
    typeof data.id === 'string' &&
    validTypes.includes(data.type) &&
    typeof data.selected === 'boolean' &&
    (data.url ? isValidUrl(data.url) : true)
  );
}

/**
 * Type guard to check if an object is valid Template
 */
export function isValidTemplate(data: any): data is Template {
  if (!data || typeof data !== 'object') return false;

  return (
    typeof data.id === 'string' &&
    typeof data.name === 'string' &&
    data?.name?.trim() !== '' &&
    typeof data.description === 'string' &&
    typeof data.category === 'string' &&
    typeof data.selected === 'boolean'
  );
}

/**
 * Helper function to validate URLs
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create initial workflow context
 */
export function createInitialContext(clientId?: string): WorkflowMachineContext {
  return {
    currentStep: 0,
    briefData: null,
    originalBriefData: null,
    motivations: [],
    copyVariations: [],
    selectedAssets: [],
    selectedTemplate: null,
    processing: false,
    uploadedFile: null,
    showBriefReview: false,
    briefConfirmed: false,
    lastError: null,
    clientId: clientId || null };
}

/**
 * Get human-readable step name
 */
export function getStepName(step: WorkflowStep): string {
  switch (step) {
    case WorkflowStep.BRIEF_UPLOAD:
      return 'Brief Upload';
    case WorkflowStep.MOTIVATION_SELECTION:
      return 'Motivation Selection';
    case WorkflowStep.COPY_GENERATION:
      return 'Copy Generation';
    case WorkflowStep.ASSET_SELECTION:
      return 'Asset Selection';
    case WorkflowStep.TEMPLATE_SELECTION:
      return 'Template Selection';
    case WorkflowStep.MATRIX_BUILD:
      return 'Matrix Build';
    case WorkflowStep.RENDERING:
      return 'Rendering';
    default:
      return 'Unknown Step';
  }
}

/**
 * Get next workflow step
 */
export function getNextStep(currentStep: WorkflowStep): WorkflowStep | null {
  if (currentStep < 0 || currentStep > WorkflowStep.RENDERING) {
    return null;
  }
  if (currentStep < WorkflowStep.RENDERING) {
    return currentStep + 1;
  }
  return null;
}

/**
 * Get previous workflow step
 */
export function getPreviousStep(currentStep: WorkflowStep): WorkflowStep | null {
  if (currentStep < 0 || currentStep > WorkflowStep.RENDERING) {
    return null;
  }
  if (currentStep > WorkflowStep.BRIEF_UPLOAD) {
    return currentStep - 1;
  }
  return null;
}

/**
 * Check if workflow can proceed to a specific step
 */
export function canProceedToStep(
  context: WorkflowMachineContext,
  targetStep: WorkflowStep
): boolean {
  switch (targetStep) {
    case WorkflowStep.BRIEF_UPLOAD:
      return true;
    case WorkflowStep.MOTIVATION_SELECTION:
      return context.briefData !== null && context.briefConfirmed;
    case WorkflowStep.COPY_GENERATION:
      return context.motivations.some(m => m.selected);
    case WorkflowStep.ASSET_SELECTION:
      return context.copyVariations.some(c => c.selected);
    case WorkflowStep.TEMPLATE_SELECTION:
      return context.selectedAssets.length > 0;
    case WorkflowStep.MATRIX_BUILD:
      return context.selectedTemplate !== null;
    case WorkflowStep.RENDERING:
      return (
        context.selectedTemplate !== null &&
        context.motivations.some(m => m.selected) &&
        context.copyVariations.some(c => c.selected) &&
        context.selectedAssets.length > 0
      );
    default:
      return false;
  }
}
