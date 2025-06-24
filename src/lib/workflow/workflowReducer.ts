import {
  WorkflowState,
  BriefData,
  Motivation,
  CopyVariation,
  Asset,
  Template} from './workflow-types';

// Action types
export type WorkflowAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_PROCESSING'; processing: boolean }
  | { type: 'SET_BRIEF_DATA'; briefData: BriefData; originalBriefData: BriefData }
  | { type: 'SET_UPLOADED_FILE'; file: File | null }
  | { type: 'SET_SHOW_BRIEF_REVIEW'; show: boolean }
  | { type: 'SET_BRIEF_CONFIRMED'; confirmed: boolean }
  | { type: 'SET_MOTIVATIONS'; motivations: Motivation[] }
  | { type: 'TOGGLE_MOTIVATION'; id: string }
  | { type: 'SET_COPY_VARIATIONS'; copyVariations: CopyVariation[] }
  | { type: 'TOGGLE_COPY'; id: string }
  | { type: 'SET_SELECTED_ASSETS'; assets: Asset[] }
  | { type: 'ADD_ASSET'; asset: Asset }
  | { type: 'REMOVE_ASSET'; id: string }
  | { type: 'SET_SELECTED_TEMPLATE'; template: Template | null }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_CLIENT_ID'; clientId: string }
  | { type: 'RESET_WORKFLOW' };

// Initial state
export const initialWorkflowState: WorkflowState = {
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
  clientId: null };

// Reducer
export function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };

    case 'SET_PROCESSING':
      return { ...state, processing: action.processing };

    case 'SET_BRIEF_DATA':
      return {
        ...state,
        briefData: action.briefData,
        originalBriefData: action.originalBriefData };

    case 'SET_UPLOADED_FILE':
      return { ...state, uploadedFile: action.file };

    case 'SET_SHOW_BRIEF_REVIEW':
      return { ...state, showBriefReview: action.show };

    case 'SET_BRIEF_CONFIRMED':
      return { ...state, briefConfirmed: action.confirmed };

    case 'SET_MOTIVATIONS':
      return { ...state, motivations: action.motivations };

    case 'TOGGLE_MOTIVATION':
      return {
        ...state,
        motivations: state?.motivations?.map((m: any) =>
          m.id === action.id ? { ...m, selected: !m.selected } : m
        )};

    case 'SET_COPY_VARIATIONS':
      return { ...state, copyVariations: action.copyVariations };

    case 'TOGGLE_COPY':
      return {
        ...state,
        copyVariations: state?.copyVariations?.map((c: any) =>
          c.id === action.id ? { ...c, selected: !c.selected } : c
        )};

    case 'SET_SELECTED_ASSETS':
      return { ...state, selectedAssets: action.assets };

    case 'ADD_ASSET':
      return {
        ...state,
        selectedAssets: [...state.selectedAssets, action.asset]};

    case 'REMOVE_ASSET':
      return {
        ...state,
        selectedAssets: state?.selectedAssets?.filter((a: any) => a.id !== action.id) };

    case 'SET_SELECTED_TEMPLATE':
      return { ...state, selectedTemplate: action.template };

    case 'SET_ERROR':
      return { ...state, lastError: action.error };

    case 'SET_CLIENT_ID':
      return { ...state, clientId: action.clientId };

    case 'RESET_WORKFLOW':
      return { ...initialWorkflowState, clientId: state.clientId };

    default:
      return state;
  }
}
