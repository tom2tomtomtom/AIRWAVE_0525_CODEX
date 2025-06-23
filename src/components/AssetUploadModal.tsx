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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
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
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { showNotification } = useNotification();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file: any) => ({
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
      'video/*': ['.mp4', '.mov', '.avi', '.webm'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg'],
    },
    multiple: true,
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      files.forEach((filePreview) => {
        formData.append('files', filePreview.file);
      });

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      if (result.success) {
        showNotification(`Successfully uploaded ${result.assets.length} file(s)!`, 'success');
        if (onUploadComplete) onUploadComplete();
        handleClose();
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      showNotification('Upload failed: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFiles([]);
      setUploadProgress(0);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth data-testid="upload-modal">
      <DialogTitle>
        Upload Assets
        <IconButton
          onClick={handleClose}
          disabled={uploading}
          sx={{ position: 'absolute', right: 8, top: 8 }}
          data-testid="close-upload-modal"
          aria-label="Close upload modal"
        >
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <Box
          {...getRootProps()}
          data-testid="dropzone"
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
          <input {...getInputProps()} data-testid="file-input" />
          <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            or click to browse files
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Supports: Images (PNG, JPG, WebP), Videos (MP4, MOV), Audio (MP3, WAV) • Max 100MB per file
          </Typography>
        </Box>

        {files.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Selected Files ({files.length})
            </Typography>
            <List dense>
              {files.map((filePreview, index) => (
                <ListItem
                  key={index}
                  secondaryAction={
                    <IconButton
                      size="small"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                      aria-label="Remove file"
                    >
                      <Close />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    {getFileIcon(filePreview.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={filePreview.file.name}
                    secondary={`${(filePreview.file.size / 1024 / 1024).toFixed(2)} MB • ${filePreview.type}`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {uploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={uploadProgress} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Uploading... {uploadProgress}%
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={uploading || files.length === 0}
          startIcon={uploading ? null : <CloudUpload />}
          data-testid="upload-files-button"
        >
          {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetUploadModal;