import { useCallback } from 'react';
import { Asset, Template } from '@/lib/workflow/workflow-types';

interface UseAssetActionsProps {
  dispatch: (action: any) => void;
}

export const useAssetActions = ({ dispatch }: UseAssetActionsProps) => {
  const selectAsset = useCallback(
    (asset: Asset) => {
      dispatch({ type: 'ADD_ASSET', asset });
    },
    [dispatch]
  );

  const removeAsset = useCallback(
    (id: string) => {
      dispatch({ type: 'REMOVE_ASSET', id });
    },
    [dispatch]
  );

  const selectTemplate = useCallback(
    (template: Template) => {
      dispatch({ type: 'SET_SELECTED_TEMPLATE', template });
    },
    [dispatch]
  );

  return {
    selectAsset,
    removeAsset,
    selectTemplate};
};
