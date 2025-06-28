import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  VideoLibrary as VideoLibraryIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useWorkflow } from '../WorkflowProvider';
import { StepComponentProps, Template } from '@/lib/workflow/workflow-types';
import { creatomateService, CreatomateTemplate } from '@/services/creatomate';

interface TemplateSelectionStepProps extends StepComponentProps {}

export const TemplateSelectionStep: React.FC<TemplateSelectionStepProps> = ({
  onNext,
  onPrevious,
}) => {
  const { state, actions } = useWorkflow();
  const { briefData, selectedTemplate, lastError } = state;

  // State for template loading
  const [templates, setTemplates] = useState<Template[]>([]);
  const [creatomateTemplates, setCreatomateTemplates] = useState<CreatomateTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Convert CreatomateTemplate to workflow Template
  const convertCreatomateTemplate = useCallback(
    (creatomateTemplate: CreatomateTemplate): Template => {
      // Determine category based on template properties
      let category = 'General';
      const tags = creatomateTemplate.tags || [];
      const name = creatomateTemplate.name.toLowerCase();

      if (
        tags.includes('social') ||
        name.includes('social') ||
        creatomateTemplate.width < creatomateTemplate.height
      ) {
        category = 'Social';
      } else if (
        tags.includes('business') ||
        name.includes('corporate') ||
        name.includes('business')
      ) {
        category = 'Business';
      } else if (tags.includes('product') || name.includes('product')) {
        category = 'Product';
      } else if (tags.includes('marketing') || name.includes('marketing')) {
        category = 'Marketing';
      } else if (tags.includes('education') || name.includes('explainer')) {
        category = 'Educational';
      }

      return {
        id: creatomateTemplate.id,
        name: creatomateTemplate.name,
        description:
          creatomateTemplate.description ||
          `${creatomateTemplate.width}x${creatomateTemplate.height} video template (${creatomateTemplate.duration}s)`,
        thumbnail: creatomateTemplate.thumbnail || creatomateTemplate.preview,
        category,
        selected: false,
      };
    },
    []
  );

  // Load templates from Creatomate
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const creatomateTemplates = await creatomateService.getTemplates(20);
      setCreatomateTemplates(creatomateTemplates);

      // Convert to workflow templates
      const workflowTemplates = creatomateTemplates.map(convertCreatomateTemplate);
      setTemplates(workflowTemplates);
    } catch (error: any) {
      console.error('Error loading templates:', error);
      setLoadError('Failed to load templates. Using default template.');

      // Fallback to default template
      const defaultTemplate = await creatomateService.getTemplate();
      const workflowTemplate = convertCreatomateTemplate(defaultTemplate);
      setTemplates([workflowTemplate]);
      setCreatomateTemplates([defaultTemplate]);
    } finally {
      setLoading(false);
    }
  }, [convertCreatomateTemplate]);

  // Load templates on component mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Handle template selection
  const handleSelectTemplate = useCallback(
    (template: Template) => {
      actions.selectTemplate(template);
    },
    [actions]
  );

  // Handle next step
  const handleNext = useCallback(() => {
    if (!selectedTemplate) {
      actions.setError('Please select a template to continue');
      return;
    }

    actions.clearError();
    onNext?.();
  }, [selectedTemplate, actions, onNext]);

  // Clear error
  const handleClearError = useCallback(() => {
    actions.clearError();
  }, [actions]);

  // Handle refresh templates
  const handleRefreshTemplates = useCallback(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Group templates by category
  const templatesByCategory = templates.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<string, Template[]>
  );

  // Get recommended templates based on brief data
  const getRecommendedTemplates = () => {
    if (!briefData || templates.length === 0) return [];

    // Enhanced recommendation logic based on platforms and brief content
    const platforms = briefData.platforms || [];
    const objective = briefData.objective?.toLowerCase() || '';
    const _targetAudience = briefData.targetAudience?.toLowerCase() || '';

    let recommendedTemplates: Template[] = [];

    // Platform-based recommendations
    if (
      platforms.includes('Instagram') ||
      platforms.includes('TikTok') ||
      platforms.includes('social')
    ) {
      recommendedTemplates = templates.filter((t: any) => t.category === 'Social');
    } else if (platforms.includes('LinkedIn') || platforms.includes('business')) {
      recommendedTemplates = templates.filter((t: any) => t.category === 'Business');
    }

    // Content-based recommendations
    if (objective.includes('product') || objective.includes('showcase')) {
      recommendedTemplates = [
        ...recommendedTemplates,
        ...templates.filter((t: any) => t.category === 'Product'),
      ];
    }

    if (objective.includes('explain') || objective.includes('educate')) {
      recommendedTemplates = [
        ...recommendedTemplates,
        ...templates.filter((t: any) => t.category === 'Educational'),
      ];
    }

    // Remove duplicates and limit to 3
    const uniqueRecommended = recommendedTemplates.filter(
      (template, index, self) => index === self.findIndex(t => t.id === template.id)
    );

    return uniqueRecommended.slice(0, 3);
  };

  const recommendedTemplates = getRecommendedTemplates();

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Template Selection
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Choose a video template that best fits your campaign style and platform requirements.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          onClick={handleRefreshTemplates}
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </Box>

      {/* Error Alerts */}
      {lastError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={handleClearError}>
          {lastError}
        </Alert>
      )}

      {loadError && (
        <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setLoadError(null)}>
          {loadError}
        </Alert>
      )}

      {/* Loading State */}
      {loading && templates.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ ml: 2 }}>
            Loading templates from Creatomate...
          </Typography>
        </Box>
      )}

      {/* Selected Template Summary */}
      {selectedTemplate && (
        <Paper sx={{ p: 3, mb: 4, bgcolor: 'primary.50', border: 1, borderColor: 'primary.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CheckCircleIcon color="primary" />
            <Box>
              <Typography variant="h6" color="primary">
                Selected Template: {selectedTemplate.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedTemplate.description}
              </Typography>
              <Chip label={selectedTemplate.category} size="small" sx={{ mt: 1 }} />
            </Box>
          </Box>
        </Paper>
      )}

      {/* Show content only when not loading or when templates are available */}
      {(!loading || templates.length > 0) && (
        <>
          {/* Recommended Templates */}
          {recommendedTemplates.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <VideoLibraryIcon />
                Recommended for Your Campaign
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 3,
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' },
                  mb: 3,
                }}
              >
                {recommendedTemplates.map((template: any) => {
                  const creatomateTemplate = creatomateTemplates.find(
                    (ct: any) => ct.id === template.id
                  );
                  return (
                    <Box key={template.id}>
                      <Card
                        sx={{
                          cursor: 'pointer',
                          border: selectedTemplate?.id === template.id ? 2 : 1,
                          borderColor:
                            selectedTemplate?.id === template.id ? 'primary.main' : 'grey.300',
                          bgcolor:
                            selectedTemplate?.id === template.id
                              ? 'primary.50'
                              : 'background.paper',
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            borderColor: 'primary.main',
                            transform: 'translateY(-2px)',
                            boxShadow: 2,
                          },
                        }}
                        onClick={() => handleSelectTemplate(template)}
                      >
                        {/* Template Preview */}
                        <Box
                          sx={{
                            height: 200,
                            backgroundImage: template.thumbnail
                              ? `url(${template.thumbnail})`
                              : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            bgcolor: template.thumbnail ? 'transparent' : 'grey.200',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                          }}
                        >
                          {!template.thumbnail && (
                            <VideoLibraryIcon sx={{ fontSize: 48, color: 'grey.500' }} />
                          )}

                          {selectedTemplate?.id === template.id && (
                            <CheckCircleIcon
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                color: 'primary.main',
                                bgcolor: 'white',
                                borderRadius: '50%',
                                fontSize: 24,
                              }}
                            />
                          )}
                          <Chip
                            label="Recommended"
                            size="small"
                            color="secondary"
                            sx={{
                              position: 'absolute',
                              bottom: 8,
                              left: 8,
                            }}
                          />
                        </Box>

                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {template.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {template.description}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip label={template.category} size="small" />
                            {creatomateTemplate && (
                              <>
                                <Chip
                                  label={`${creatomateTemplate.width}×${creatomateTemplate.height}`}
                                  size="small"
                                  variant="outlined"
                                />
                                <Chip
                                  label={`${creatomateTemplate.duration}s`}
                                  size="small"
                                  variant="outlined"
                                />
                              </>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* All Templates by Category */}
          {templates.length > 0 ? (
            <>
              <Typography variant="h6" gutterBottom>
                All Templates ({templates.length})
              </Typography>

              {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
                <Box key={category} sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                    {category} ({categoryTemplates.length})
                  </Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gap: 3,
                      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' },
                    }}
                  >
                    {categoryTemplates.map((template: any) => {
                      const creatomateTemplate = creatomateTemplates.find(
                        (ct: any) => ct.id === template.id
                      );
                      return (
                        <Box key={template.id}>
                          <Card
                            sx={{
                              cursor: 'pointer',
                              border: selectedTemplate?.id === template.id ? 2 : 1,
                              borderColor:
                                selectedTemplate?.id === template.id ? 'primary.main' : 'grey.300',
                              bgcolor:
                                selectedTemplate?.id === template.id
                                  ? 'primary.50'
                                  : 'background.paper',
                              transition: 'all 0.2s ease-in-out',
                              '&:hover': {
                                borderColor: 'primary.main',
                                transform: 'translateY(-2px)',
                                boxShadow: 2,
                              },
                            }}
                            onClick={() => handleSelectTemplate(template)}
                          >
                            {/* Template Preview */}
                            <Box
                              sx={{
                                height: 200,
                                backgroundImage: template.thumbnail
                                  ? `url(${template.thumbnail})`
                                  : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                bgcolor: template.thumbnail ? 'transparent' : 'grey.200',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                              }}
                            >
                              {!template.thumbnail && (
                                <VideoLibraryIcon sx={{ fontSize: 48, color: 'grey.500' }} />
                              )}

                              {selectedTemplate?.id === template.id && (
                                <CheckCircleIcon
                                  sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    color: 'primary.main',
                                    bgcolor: 'white',
                                    borderRadius: '50%',
                                    fontSize: 24,
                                  }}
                                />
                              )}
                            </Box>

                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                {template.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {template.description}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Chip label={template.category} size="small" />
                                {creatomateTemplate && (
                                  <>
                                    <Chip
                                      label={`${creatomateTemplate.width}×${creatomateTemplate.height}`}
                                      size="small"
                                      variant="outlined"
                                    />
                                    <Chip
                                      label={`${creatomateTemplate.duration}s`}
                                      size="small"
                                      variant="outlined"
                                    />
                                  </>
                                )}
                              </Box>
                            </CardContent>
                          </Card>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </>
          ) : (
            !loading && (
              <Alert severity="info" sx={{ mb: 4 }}>
                No templates available. Please check your Creatomate API connection or try
                refreshing.
              </Alert>
            )
          )}
        </>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', mt: 4 }}>
        <Button variant="outlined" onClick={onPrevious} startIcon={<ArrowBackIcon />}>
          Back to Assets
        </Button>

        <Button
          variant="contained"
          onClick={handleNext}
          endIcon={<ArrowForwardIcon />}
          disabled={!selectedTemplate}
        >
          Build Campaign Matrix
        </Button>
      </Box>
    </Box>
  );
};
