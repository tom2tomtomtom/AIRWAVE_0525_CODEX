/**
 * TemplateSelector Component
 * Extracted from video-studio.tsx for better maintainability
 * Low risk extraction - pure UI component with minimal dependencies
 */

import React from 'react';
import { Box, Typography, Card, CardContent, CardMedia, Button, Grid, Chip } from '@mui/material';

interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  preview?: string;
  duration: number;
  aspect_ratio: string;
  platform: string[];
  category: string;
  tags: string[];
}

interface TemplateSelectorProps {
  templates: VideoTemplate[];
  selectedTemplate: VideoTemplate | null;
  onTemplateSelect: (template: VideoTemplate) => void;
  onContinue: () => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  templates,
  selectedTemplate,
  onTemplateSelect,
  onContinue,
}) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Choose a Video Template
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Select a template that best fits your video needs
        </Typography>

        <Grid container spacing={2}>
          {templates.map(template => (
            <Grid size={{ xs: 12, sm: 6, md: 6 }} key={template.id}>
              <Card
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: selectedTemplate?.id === template.id ? '2px solid' : '1px solid',
                  borderColor: selectedTemplate?.id === template.id ? 'primary.main' : 'divider',
                  '&:hover': {
                    boxShadow: 2,
                    transform: 'translateY(-2px)',
                  },
                }}
                onClick={() => onTemplateSelect(template)}
              >
                <CardMedia
                  component="img"
                  height="140"
                  image={template.thumbnail}
                  alt={template.name}
                />
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {template.description}
                  </Typography>
                  <Box display="flex" gap={0.5} mb={1}>
                    <Chip label={template.category} size="small" />
                    <Chip label={template.aspect_ratio} size="small" variant="outlined" />
                    <Chip label={`${template.duration}s`} size="small" variant="outlined" />
                  </Box>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {template.platform.map(platform => (
                      <Chip
                        key={platform}
                        label={platform}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box mt={3}>
          <Button variant="contained" onClick={onContinue} disabled={!selectedTemplate}>
            Continue with Selected Template
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TemplateSelector;
