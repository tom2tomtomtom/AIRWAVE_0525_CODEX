import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  Alert,
  IconButton,
  Stack,
} from '@mui/material';
import {
  Close as CloseIcon,
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useClient } from '@/contexts/ClientContext';
import { useNotification } from '@/contexts/NotificationContext';
import { uploadAsset, createAssetRecord, getFileType } from '@/lib/assets';
import type { Asset } from '@/types/models';

interface AssetUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete?: (asset: Asset) => void;
  category?: string;
  metadata?: Record<string, string | number | boolean>;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  asset?: Asset;
}

const AssetUploadModal: React.FC<AssetUploadModalProps> = ({
  open,
  onClose,
  onUploadComplete,
  category = 'general',
  metadata = {},
}) => {
  const { activeClient } = useClient();
  const { showNotification } = useNotification();
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFile>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!activeClient) {
      showNotification('Please select a client first', 'error');
      return;
    }

    setIsUploading(true);
    const newUploadingFiles = new Map(uploadingFiles);

    for (const file of acceptedFiles) {
      const fileKey = `${file.name}-${Date.now()}`;
      newUploadingFiles.set(fileKey, {
        file,
        progress: 0,
        status: 'uploading',
      });
      setUploadingFiles(new Map(newUploadingFiles));

      try {
        // Upload file to storage
        const uploadResult = await uploadAsset(
          file,
          activeClient.id,
          category,
          (progress) => {
            setUploadingFiles(prev => {
              const updated = new Map(prev);
              const fileData = updated.get(fileKey);
              if (fileData) {
                fileData.progress = progress;
                updated.set(fileKey, fileData);
              }
              return updated;
            });
          }
        );

        // Create asset record in database
        const fileType = getFileType(file.type);
        const asset = await createAssetRecord({
          clientId: activeClient.id,
          name: file.name,
          type: fileType,
          url: uploadResult.url,
          size: file.size,
          mimeType: file.type,
          category,
          metadata: {
            ...metadata,
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
          },
        });

        // Update file status
        setUploadingFiles(prev => {
          const updated = new Map(prev);
          updated.set(fileKey, {
            file,
            progress: 100,
            status: 'success',
            asset,
          });
          return updated;
        });

        showNotification(`${file.name} uploaded successfully`, 'success');
        if (onUploadComplete && asset) {
          onUploadComplete(asset);
        }
      } catch (error) {
        console.error('Upload error:', error);
        setUploadingFiles(prev => {
          const updated = new Map(prev);
          updated.set(fileKey, {
            file,
            progress: 0,
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed',
          });
          return updated;
        });
        showNotification(`Failed to upload ${file.name}`, 'error');
      }
    }

    setIsUploading(false);
  }, [activeClient, uploadingFiles, category, metadata, showNotification, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm'],
      'audio/*': ['.mp3', '.wav', '.ogg', '.m4a'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/json': ['.json'],
    },
    multiple: true,
  });

  const handleClose = () => {
    if (!isUploading) {
      setUploadingFiles(new Map());
      onClose();
    }
  };

  const uploadingFilesList = Array.from(uploadingFiles.values());
  const successCount = uploadingFilesList.filter(f => f.status === 'success').length;
  const errorCount = uploadingFilesList.filter(f => f.status === 'error').length;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={isUploading}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Upload Assets</Typography>
          <IconButton 
            onClick={handleClose} 
            disabled={isUploading}
            size="small"
            edge="end"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            bgcolor: isDragActive ? 'action.hover' : 'background.paper',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
        >
          <input {...getInputProps()} />
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            or click to browse files
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Supported: Images, Videos, Audio, PDFs, Text files
          </Typography>
        </Box>

        {uploadingFilesList.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Uploading {uploadingFilesList.length} file(s)
            </Typography>
            
            {successCount > 0 && (
              <Alert severity="success" sx={{ mb: 1 }}>
                {successCount} file(s) uploaded successfully
              </Alert>
            )}
            
            {errorCount > 0 && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {errorCount} file(s) failed to upload
              </Alert>
            )}

            <Stack spacing={1}>
              {uploadingFilesList.map((uploadingFile, index) => (
                <Box key={index} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    {uploadingFile.status === 'success' ? (
                      <SuccessIcon color="success" sx={{ mr: 1 }} />
                    ) : uploadingFile.status === 'error' ? (
                      <ErrorIcon color="error" sx={{ mr: 1 }} />
                    ) : (
                      <UploadIcon color="action" sx={{ mr: 1 }} />
                    )}
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {uploadingFile.file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(uploadingFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </Typography>
                  </Box>
                  
                  {uploadingFile.status === 'uploading' && (
                    <LinearProgress 
                      variant="determinate" 
                      value={uploadingFile.progress} 
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  )}
                  
                  {uploadingFile.error && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                      {uploadingFile.error}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button 
          onClick={handleClose}
          disabled={isUploading}
        >
          {isUploading ? 'Cancel' : 'Close'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetUploadModal;