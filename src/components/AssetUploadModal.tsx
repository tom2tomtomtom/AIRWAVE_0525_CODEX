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
  IconButton,
  Alert,
} from '@mui/material';
import {
  CloudUpload,
  Close,
  InsertDriveFile,
  Image as ImageIcon,
  VideoFile,
  AudioFile,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useFileUpload, useCreateAsset } from '@/hooks/useData';
import { useClient } from '@/contexts/ClientContext';
import { useNotification } from '@/contexts/NotificationContext';

interface AssetUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

interface FilePreview {
  file: File;
  preview: string;
  type: string;
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return <ImageIcon />;
  if (type.startsWith('video/')) return <VideoFile />;
  if (type.startsWith('audio/')) return <AudioFile />;
  return <InsertDriveFile />;
};

export const AssetUploadModal: React.FC<AssetUploadModalProps> = ({
  open,
  onClose,
  onUploadComplete,
}) => {
  const { activeClient } = useClient();
  const { uploadFile, isUploading, uploadProgress } = useFileUpload();
  const { createAsset } = useCreateAsset();
  const { showNotification } = useNotification();
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi'],
      'audio/*': ['.mp3', '.wav', '.m4a'],
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!activeClient || files.length === 0) return;

    setUploading(true);
    let successCount = 0;

    try {
      for (const filePreview of files) {
        const { file } = filePreview;
        
        // Upload file
        const { url, error } = await uploadFile(file, activeClient.id);
        
        if (error) {
          showNotification(`Failed to upload ${file.name}: ${error.message}`, 'error');
          continue;
        }

        // Create asset record
        const assetType = file.type.startsWith('image/') ? 'image' : 
                         file.type.startsWith('video/') ? 'video' : 
                         file.type.startsWith('audio/') ? 'audio' : 'document';

        const { error: assetError } = await createAsset({
          name: file.name,
          type: assetType,
          url,
          thumbnail: assetType === 'image' ? url : undefined,
          clientId: activeClient.id,
          tags: ['uploaded'],
          status: 'active',
          permissions: {
            public: false,
            userIds: ['user-1'],
            roleIds: ['admin', 'editor'],
          },
          metadata: {
            fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
            mimeType: file.type,
            originalName: file.name,
          },
        });

        if (assetError) {
          showNotification(`Failed to create asset record for ${file.name}`, 'error');
          continue;
        }

        successCount++;
      }

      if (successCount > 0) {
        showNotification(
          `Successfully uploaded ${successCount} file${successCount > 1 ? 's' : ''}`,
          'success'
        );
        onUploadComplete?.();
        handleClose();
      }
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFiles([]);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Upload Assets
        <IconButton
          onClick={handleClose}
          disabled={uploading}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {!activeClient ? (
          <Alert severity="warning">Please select a client first</Alert>
        ) : (
          <>
            <Box
              {...getRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: isDragActive ? 'primary.main' : 'divider',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <input {...getInputProps()} />
              <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                or click to select files
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Supported: Images, Videos, Audio files
              </Typography>
            </Box>

            {files.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Files to upload ({files.length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {files.map((filePreview, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                      }}
                    >
                      {filePreview.type.startsWith('image/') ? (
                        <Box
                          component="img"
                          src={filePreview.preview}
                          sx={{
                            width: 48,
                            height: 48,
                            objectFit: 'cover',
                            borderRadius: 1,
                            mr: 2,
                          }}
                        />
                      ) : (
                        <Box sx={{ mr: 2 }}>{getFileIcon(filePreview.type)}</Box>
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" noWrap>
                          {filePreview.file.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(filePreview.file.size / 1024 / 1024).toFixed(2)} MB
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => removeFile(index)}
                        disabled={uploading}
                      >
                        <Close />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {isUploading && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress variant="determinate" value={uploadProgress} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Uploading... {uploadProgress}%
                </Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={uploading || files.length === 0 || !activeClient}
          startIcon={uploading ? null : <CloudUpload />}
        >
          {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetUploadModal;
