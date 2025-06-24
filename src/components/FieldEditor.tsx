import React, { useCallback } from 'react';
import { Box, TextField, Button, Typography, IconButton, Chip } from '@mui/material';
import {
  Image as ImageIcon,
  TextFields as TextFieldsIcon,
  Videocam as VideoIcon,
  Audiotrack as AudiotrackIcon,
  ColorLens as ColorLensIcon,
  Link as LinkIcon,
  Edit as EditIcon} from '@mui/icons-material';
import { Asset } from './AssetCard';

export interface DynamicField {
  id: string;
  name: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'color' | 'link';
  required: boolean;
  description: string;
  value?: string;
  assetId?: string;
}

interface FieldAssignment {
  assetId?: string;
  value?: string;
  status: 'empty' | 'in-progress' | 'completed';
}

interface FieldEditorProps {
  field: DynamicField;
  assignment?: FieldAssignment;
  asset?: Asset | null;
  onTextChange: (fieldId: string, value: string) => void;
  onAssetSelect: (fieldId: string) => void;
  compact?: boolean;
}

const FieldEditor: React.FC<FieldEditorProps> = ({
  field,
  assignment,
  asset,
  onTextChange,
  onAssetSelect,
  compact = false}) => {
  const getFieldTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'text':
        return <TextFieldsIcon fontSize="small" />;
      case 'image':
        return <ImageIcon fontSize="small" />;
      case 'video':
        return <VideoIcon fontSize="small" />;
      case 'audio':
        return <AudiotrackIcon fontSize="small" />;
      case 'color':
        return <ColorLensIcon fontSize="small" />;
      case 'link':
        return <LinkIcon fontSize="small" />;
      default:
        return <TextFieldsIcon fontSize="small" />;
    }
  }, []);

  const handleTextFieldChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onTextChange(field.id, event.target.value);
    },
    [field.id, onTextChange]
  );

  const handleAssetSelectClick = useCallback(() => {
    onAssetSelect(field.id);
  }, [field.id, onAssetSelect]);

  const renderFieldContent = () => {
    // Text and color fields
    if (field.type === 'text' || field.type === 'color') {
      return (
        <TextField
          fullWidth
          size={compact ? 'small' : 'medium'}
          placeholder={`Enter ${field.type}...`}
          value={assignment?.value || ''}
          onChange={handleTextFieldChange}
          type={field.type === 'color' ? 'color' : 'text'}
          multiline={field.type === 'text' && field.name.toLowerCase().includes('description')}
          rows={field.type === 'text' && field.name.toLowerCase().includes('description') ? 3 : 1}
          sx={{
            '& .MuiInputBase-input[type="color"]': {
              minHeight: '2rem',
              padding: '4px' }}}
        />
      );
    }

    // Asset fields (image, video, audio)
    if (field.type === 'image' || field.type === 'video' || field.type === 'audio') {
      if (asset && assignment?.assetId) {
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Asset preview */}
            {field.type === 'image' && (
              <Box
                component="img"
                src={asset.url}
                alt={asset.name}
                sx={{
                  width: compact ? 40 : 60,
                  height: compact ? 40 : 60,
                  objectFit: 'cover',
                  borderRadius: 1,
                  flexShrink: 0 }}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}

            {field.type !== 'image' && (
              <Box
                sx={{
                  width: compact ? 40 : 60,
                  height: compact ? 40 : 60,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  flexShrink: 0 }}
              >
                {getFieldTypeIcon(field.type)}
              </Box>
            )}

            {/* Asset info */}
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant={compact ? 'caption' : 'body2'} noWrap>
                {asset.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {asset.metadata.fileSize}
                {asset.metadata.dimensions && ` • ${asset.metadata.dimensions}`}
                {asset.metadata.duration && ` • ${asset.metadata.duration}`}
              </Typography>
            </Box>

            {/* Change button */}
            <IconButton
              size="small"
              onClick={handleAssetSelectClick}
              title="Change asset"
              aria-label="Icon button"
            >
              {' '}
              <EditIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      } else {
        return (
          <Button
            variant="outlined"
            startIcon={getFieldTypeIcon(field.type)}
            onClick={handleAssetSelectClick}
            size={compact ? 'small' : 'medium'}
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none' }}
          >
            Select {field.type}
          </Button>
        );
      }
    }

    // Link fields
    if (field.type === 'link') {
      return (
        <TextField
          fullWidth
          size={compact ? 'small' : 'medium'}
          placeholder="Enter URL..."
          value={assignment?.value || ''}
          onChange={handleTextFieldChange}
          type="url"
        />
      );
    }

    // Default fallback
    return (
      <TextField
        fullWidth
        size={compact ? 'small' : 'medium'}
        placeholder={`Enter ${field.type}...`}
        value={assignment?.value || ''}
        onChange={handleTextFieldChange}
      />
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Field header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
        {getFieldTypeIcon(field.type)}
        <Typography variant={compact ? 'body2' : 'subtitle2'} sx={{ fontWeight: 500 }}>
          {field.name}
        </Typography>
        {field.required && (
          <Chip
            label="Required"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        )}
      </Box>

      {/* Field description */}
      {field.description && !compact && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          {field.description}
        </Typography>
      )}

      {/* Field content */}
      {renderFieldContent()}
    </Box>
  );
};

export default React.memo(FieldEditor);
