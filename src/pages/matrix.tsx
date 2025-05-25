import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  Divider,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  InputAdornment,
  Alert,
  CardMedia,
  Stack,
  Fab,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  TextFields as TextFieldsIcon,
  Videocam as VideoIcon,
  Audiotrack as AudiotrackIcon,
  ColorLens as ColorLensIcon,
  Link as LinkIcon,
  Search as SearchIcon,
  ViewModule as MatrixIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { useClient } from '@/contexts/ClientContext';
import DashboardLayout from '@/components/DashboardLayout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { demoTemplates } from '@/utils/demoData';

// Define types
interface DynamicField {
  id: string;
  name: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'color' | 'link';
  required: boolean;
  description: string;
}

interface Template {
  id: string;
  name: string;
  platform: string;
  aspect_ratio: string;
  dimensions: string;
  description: string;
  thumbnail_url: string;
  category: string;
  content_type: string;
  usage_count: number;
  performance_score: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  dynamic_fields?: DynamicField[];
  is_creatomate?: boolean;
  creatomate_id?: string;
}

interface FieldAssignment {
  fieldId: string;
  assetId?: string;
  value?: string;
  status: 'empty' | 'in-progress' | 'completed';
}

interface Matrix {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  fieldAssignments: Record<string, FieldAssignment>;
  created_at: string;
  status: 'draft' | 'active' | 'completed';
}

// Add dynamic fields to demo templates
const templatesWithFields: Template[] = demoTemplates.map(template => ({
  ...template,
  dynamic_fields: [
    {
      id: 'df1',
      name: 'Headline',
      type: 'text' as const,
      required: true,
      description: `Main headline text for ${template.name}`
    },
    {
      id: 'df2',
      name: 'Background Image',
      type: 'image' as const,
      required: true,
      description: 'Background or main image'
    },
    {
      id: 'df3',
      name: 'Call to Action',
      type: 'text' as const,
      required: false,
      description: 'Optional call to action text'
    },
    ...(template.platform === 'instagram' ? [{
      id: 'df4',
      name: 'Story Link',
      type: 'link' as const,
      required: false,
      description: 'Swipe up link (if applicable)'
    }] : []),
    ...(template.platform === 'youtube' ? [{
      id: 'df5',
      name: 'Video Duration',
      type: 'text' as const,
      required: false,
      description: 'Video duration overlay'
    }] : [])
  ],
  is_creatomate: true,
  creatomate_id: `crt-${template.id}`
}));

// Matrix Page Component
const MatrixPage: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { activeClient: selectedClient } = useClient();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [fieldAssignments, setFieldAssignments] = useState<Record<string, FieldAssignment>>({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [savedMatrices, setSavedMatrices] = useState<Matrix[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [matrixName, setMatrixName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  useEffect(() => {
    // Initialize field assignments when template is selected
    if (selectedTemplate && selectedTemplate.dynamic_fields) {
      const initialAssignments: Record<string, FieldAssignment> = {};
      selectedTemplate.dynamic_fields.forEach(field => {
        initialAssignments[field.id] = {
          fieldId: field.id,
          status: 'empty'
        };
      });
      setFieldAssignments(initialAssignments);
    }
  }, [selectedTemplate]);

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setMatrixName(`${template.name} - ${new Date().toLocaleDateString()}`);
  };

  const handleFieldUpdate = (fieldId: string, value: string | undefined, assetId?: string) => {
    setFieldAssignments(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        value,
        assetId,
        status: value || assetId ? 'completed' : 'empty'
      }
    }));
  };

  const handleSaveMatrix = async () => {
    if (!selectedTemplate || !matrixName) return;
    
    setLoading(true);
    setSaveSuccess(false);
    
    try {
      // Simulate saving matrix
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newMatrix: Matrix = {
        id: `matrix-${Date.now()}`,
        name: matrixName,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        fieldAssignments,
        created_at: new Date().toISOString(),
        status: 'draft'
      };
      
      setSavedMatrices([...savedMatrices, newMatrix]);
      setSaveSuccess(true);
      
      // Reset after success
      setTimeout(() => {
        setSelectedTemplate(null);
        setFieldAssignments({});
        setMatrixName('');
        setSaveSuccess(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error saving matrix:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <TextFieldsIcon />;
      case 'image':
        return <ImageIcon />;
      case 'video':
        return <VideoIcon />;
      case 'audio':
        return <AudiotrackIcon />;
      case 'color':
        return <ColorLensIcon />;
      case 'link':
        return <LinkIcon />;
      default:
        return <TextFieldsIcon />;
    }
  };

  const filteredTemplates = templatesWithFields.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.platform.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isMatrixComplete = selectedTemplate?.dynamic_fields?.every(field => 
    field.required ? fieldAssignments[field.id]?.status === 'completed' : true
  ) ?? false;

  return (
    <DashboardLayout title="Matrix Editor">
      <Head>
        <title>Matrix Editor | AIrWAVE</title>
      </Head>

      <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Matrix Editor
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create content matrices by combining templates with your assets
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateDialog(true)}
            size="large"
          >
            Create New Matrix
          </Button>
        </Box>

        {isDemoMode && (
          <Alert severity="info" sx={{ mb: 3 }}>
            You're in demo mode. Matrices will be saved temporarily for demonstration purposes.
          </Alert>
        )}

        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Matrix saved successfully!
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Template Selection */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <TextField
                fullWidth
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              
              <Typography variant="h6" gutterBottom>
                Select Template
              </Typography>
              
              <Box sx={{ maxHeight: 600, overflowY: 'auto' }}>
                {filteredTemplates.map((template) => (
                  <Card
                    key={template.id}
                    sx={{
                      mb: 2,
                      cursor: 'pointer',
                      border: selectedTemplate?.id === template.id ? 2 : 0,
                      borderColor: 'primary.main',
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 3,
                      }
                    }}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    {template.thumbnail_url && (
                      <CardMedia
                        component="img"
                        height="140"
                        image={template.thumbnail_url}
                        alt={template.name}
                      />
                    )}
                    <CardContent>
                      <Typography variant="subtitle1">
                        {template.name}
                      </Typography>
                      <Box display="flex" gap={1} mt={1}>
                        <Chip label={template.platform} size="small" />
                        <Chip label={template.aspect_ratio} size="small" variant="outlined" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {template.description}
                      </Typography>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                        <Typography variant="caption" color="text.secondary">
                          Used {template.usage_count} times
                        </Typography>
                        <Chip 
                          label={`${Math.round(template.performance_score * 100)}%`} 
                          size="small" 
                          color="success"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Paper>

            {/* Saved Matrices */}
            {savedMatrices.length > 0 && (
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Saved Matrices
                </Typography>
                <Stack spacing={1}>
                  {savedMatrices.map((matrix) => (
                    <Card key={matrix.id} variant="outlined">
                      <CardContent sx={{ py: 1 }}>
                        <Typography variant="subtitle2">{matrix.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {matrix.templateName} • {new Date(matrix.created_at).toLocaleDateString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Paper>
            )}
          </Grid>

          {/* Field Assignment */}
          <Grid item xs={12} md={8}>
            {selectedTemplate ? (
              <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                  <Box>
                    <TextField
                      value={matrixName}
                      onChange={(e) => setMatrixName(e.target.value)}
                      variant="standard"
                      placeholder="Matrix Name"
                      sx={{ 
                        fontSize: '1.5rem',
                        '& input': { fontSize: '1.5rem' }
                      }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {selectedTemplate.platform} • {selectedTemplate.dimensions} • {selectedTemplate.content_type}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                    onClick={handleSaveMatrix}
                    disabled={loading || !isMatrixComplete || !matrixName}
                  >
                    {loading ? 'Saving...' : 'Save Matrix'}
                  </Button>
                </Box>

                <Divider sx={{ mb: 3 }} />

                <Typography variant="h6" gutterBottom>
                  Dynamic Fields
                </Typography>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Field</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Required</TableCell>
                        <TableCell>Value/Asset</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedTemplate.dynamic_fields?.map((field) => (
                        <TableRow key={field.id}>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              {getFieldIcon(field.type)}
                              <Box>
                                <Typography variant="body1">
                                  {field.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {field.description}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip label={field.type} size="small" />
                          </TableCell>
                          <TableCell>
                            {field.required ? (
                              <Chip label="Required" size="small" color="error" />
                            ) : (
                              <Chip label="Optional" size="small" variant="outlined" />
                            )}
                          </TableCell>
                          <TableCell>
                            {field.type === 'text' ? (
                              <TextField
                                size="small"
                                fullWidth
                                value={fieldAssignments[field.id]?.value || ''}
                                onChange={(e) => handleFieldUpdate(field.id, e.target.value)}
                                placeholder="Enter text..."
                              />
                            ) : field.type === 'color' ? (
                              <TextField
                                size="small"
                                type="color"
                                value={fieldAssignments[field.id]?.value || '#000000'}
                                onChange={(e) => handleFieldUpdate(field.id, e.target.value)}
                              />
                            ) : field.type === 'link' ? (
                              <TextField
                                size="small"
                                fullWidth
                                type="url"
                                value={fieldAssignments[field.id]?.value || ''}
                                onChange={(e) => handleFieldUpdate(field.id, e.target.value)}
                                placeholder="https://..."
                              />
                            ) : (
                              <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => router.push('/assets')}
                              >
                                Select {field.type}
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={fieldAssignments[field.id]?.status || 'empty'}
                              size="small"
                              color={
                                fieldAssignments[field.id]?.status === 'completed'
                                  ? 'success'
                                  : fieldAssignments[field.id]?.status === 'in-progress'
                                  ? 'warning'
                                  : 'default'
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            ) : (
              <Paper sx={{ p: 8, textAlign: 'center' }}>
                <MatrixIcon sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Select a template to begin creating your matrix
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose from our library of optimized templates for various platforms
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      </Box>

      {/* Create Matrix Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)}>
        <DialogTitle>Create New Matrix</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            A matrix allows you to create multiple content variations from a single template.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Start by selecting a template from the library, then fill in the dynamic fields with your content.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setShowCreateDialog(false);
              // Focus on template selection
            }}
          >
            Get Started
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
};

export default MatrixPage;
