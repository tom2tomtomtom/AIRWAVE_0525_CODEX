import { useState, useCallback } from 'react';

// Modal states and management
interface ModalState {
  isOpen: boolean;
  data?: any;
  isLoading?: boolean;
}

interface ModalManagerHook {
  modals: Record<string, ModalState>;
  openModal: (modalId: string, data?: any) => void;
  closeModal: (modalId: string) => void;
  closeAllModals: () => void;
  isModalOpen: (modalId: string) => boolean;
  getModalData: (modalId: string) => any;
  setModalLoading: (modalId: string, loading: boolean) => void;
}

/**
 * Hook for managing multiple lazy-loaded modals
 * Provides a centralized way to open/close modals with data passing
 */
export const useModalManager = (initialModals: string[] = []): ModalManagerHook => {
  const [modals, setModals] = useState<Record<string, ModalState>>(() => {
    const initial: Record<string, ModalState> = {};
    initialModals.forEach(modalId => {
      initial[modalId] = { isOpen: false };
    });
    return initial;
  });

  const openModal = useCallback((modalId: string, data?: any) => {
    setModals(prev => ({
      ...prev,
      [modalId]: {
        isOpen: true,
        data,
        isLoading: false,
      },
    }));
  }, []);

  const closeModal = useCallback((modalId: string) => {
    setModals(prev => ({
      ...prev,
      [modalId]: {
        ...prev[modalId],
        isOpen: false,
        isLoading: false,
      },
    }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(modalId => {
        updated[modalId] = {
          ...updated[modalId],
          isOpen: false,
          isLoading: false,
        };
      });
      return updated;
    });
  }, []);

  const isModalOpen = useCallback((modalId: string) => {
    return modals[modalId]?.isOpen || false;
  }, [modals]);

  const getModalData = useCallback((modalId: string) => {
    return modals[modalId]?.data;
  }, [modals]);

  const setModalLoading = useCallback((modalId: string, loading: boolean) => {
    setModals(prev => ({
      ...prev,
      [modalId]: {
        isOpen: prev[modalId]?.isOpen || false,
        data: prev[modalId]?.data,
        isLoading: loading,
      },
    }));
  }, []);

  return {
    modals,
    openModal,
    closeModal,
    closeAllModals,
    isModalOpen,
    getModalData,
    setModalLoading,
  };
};

/**
 * Pre-configured modal IDs for common use cases
 */
export const MODAL_IDS = {
  // Content creation modals
  BRIEF_UPLOAD: 'briefUpload',
  ASSET_UPLOAD: 'assetUpload',
  BRIEF_DIALOG: 'briefDialog',
  
  // AI-powered modals
  AI_IMAGE_GENERATOR: 'aiImageGenerator',
  
  // Management modals
  CLIENT_FORM: 'clientForm',
  TEMPLATE_EDITOR: 'templateEditor',
  CAMPAIGN_SETTINGS: 'campaignSettings',
  
  // Preview modals
  ASSET_PREVIEW: 'assetPreview',
  VIDEO_PLAYER: 'videoPlayer',
  
  // Analytics modals
  ANALYTICS_DETAILS: 'analyticsDetails',
  
  // Social media modals
  SOCIAL_PUBLISH: 'socialPublish',
  
  // Workflow modals
  APPROVAL_WORKFLOW: 'approvalWorkflow',
  ONBOARDING_WIZARD: 'onboardingWizard',
  
  // Admin modals
  USER_MANAGEMENT: 'userManagement',
} as const;

/**
 * Hook specifically for content creation modals
 */
export const useContentModals = () => {
  return useModalManager([
    MODAL_IDS.BRIEF_UPLOAD,
    MODAL_IDS.ASSET_UPLOAD,
    MODAL_IDS.BRIEF_DIALOG,
    MODAL_IDS.AI_IMAGE_GENERATOR,
  ]);
};

/**
 * Hook specifically for asset management modals
 */
export const useAssetModals = () => {
  return useModalManager([
    MODAL_IDS.ASSET_UPLOAD,
    MODAL_IDS.ASSET_PREVIEW,
    MODAL_IDS.VIDEO_PLAYER,
  ]);
};

/**
 * Hook specifically for campaign management modals
 */
export const useCampaignModals = () => {
  return useModalManager([
    MODAL_IDS.CAMPAIGN_SETTINGS,
    MODAL_IDS.TEMPLATE_EDITOR,
    MODAL_IDS.APPROVAL_WORKFLOW,
  ]);
};

/**
 * Hook specifically for admin modals
 */
export const useAdminModals = () => {
  return useModalManager([
    MODAL_IDS.USER_MANAGEMENT,
    MODAL_IDS.CLIENT_FORM,
  ]);
};

/**
 * Hook for a single modal with simplified API
 */
export const useSingleModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<any>();

  const openModal = useCallback((modalData?: any) => {
    setData(modalData);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setData(undefined);
  }, []);

  return {
    isOpen,
    data,
    openModal,
    closeModal,
  };
};