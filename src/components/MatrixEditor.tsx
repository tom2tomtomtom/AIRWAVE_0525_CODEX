import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Button,
  IconButton
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { Template, Asset } from '@/types/models';

export interface MatrixProject {
  id: string;
  name: string;
  description: string;
  templates: Template[];
  fieldAssignments: Record<string, {
    assetId?: string;
    value?: string;
    status: 'empty' | 'in-progress' | 'completed';
  }>;
}

interface MatrixEditorProps {
  project: MatrixProject;
  getAssetById: (id: string) => Asset | undefined;
  handleTextFieldChange: (tid: string, fid: string, val: string) => void;
  handleOpenAssetDialog: (tid: string, fid: string) => void;
}

const getFieldTypeIcon = (type: string) => {
  switch (type) {
    case 'text':
      return <EditIcon fontSize="small" />;
    case 'image':
      return <RefreshIcon fontSize="small" />;
    default:
      return null;
  }
};

const MatrixEditor: React.FC<MatrixEditorProps> = ({
  project,
  getAssetById,
  handleTextFieldChange,
  handleOpenAssetDialog,
}) => (
  <Paper sx={{ p: 3, mb: 4 }}>
    <Typography variant="h6" gutterBottom>
      Template Fields Matrix
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      Assign assets and content to each template field
    </Typography>
    {project.templates.map((template) => (
      <Box key={template.id} sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="medium">
            {template.name}
          </Typography>
          <Chip label={template.platform} size="small" sx={{ ml: 1 }} />
          <Chip
            label={template.aspectRatio}
            size="small"
            variant="outlined"
            sx={{ ml: 1 }}
          />
        </Box>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width="20%">Field</TableCell>
                <TableCell width="15%">Type</TableCell>
                <TableCell width="45%">Content</TableCell>
                <TableCell width="20%">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {template.dynamicFields.map((field) => {
                const key = `${template.id}-${field.id}`;
                const assignment = project.fieldAssignments[key];
                const asset = assignment?.assetId
                  ? getAssetById(assignment.assetId)
                  : undefined;
                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {field.name}
                        {field.required && (
                          <Chip
                            label="Required"
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {field.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getFieldTypeIcon(field.type)}
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          {field.type}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {field.type === 'text' ? (
                        <TextField
                          fullWidth
                          size="small"
                          placeholder={`Enter ${field.type}...`}
                          value={assignment?.value || ''}
                          onChange={(e) =>
                            handleTextFieldChange(template.id, field.id, e.target.value)
                          }
                        />
                      ) : asset ? (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="body2">{asset.name}</Typography>
                          <IconButton
                            size="small"
                            sx={{ ml: 'auto' }}
                            onClick={() => handleOpenAssetDialog(template.id, field.id)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ) : (
                        <Button
                          variant="outlined"
                          onClick={() => handleOpenAssetDialog(template.id, field.id)}
                        >
                          Select {field.type}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={assignment?.status === 'completed'
                          ? 'Completed'
                          : assignment?.status === 'in-progress'
                          ? 'In Progress'
                          : 'Empty'}
                        color={assignment?.status === 'completed'
                          ? 'success'
                          : assignment?.status === 'in-progress'
                          ? 'primary'
                          : 'default'}
                        size="small"
                        icon={assignment?.status === 'completed' ? <CheckIcon /> : assignment?.status === 'in-progress' ? <RefreshIcon /> : <CloseIcon />}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    ))}
  </Paper>
);

export default MatrixEditor;
