import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  Stack,
  Grid} from '@mui/material';
import {
  Upload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  Palette as PaletteIcon,
  TextFormat as TextFormatIcon,
  VoiceOverOff as VoiceOverOffIcon} from '@mui/icons-material';
interface BrandGuidelinesProps {
  brandGuidelines: any;
  brandGuidelinesUploading: boolean;
  dragActive: boolean;
  activeClient: any;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
const BrandGuidelinesSection: React.FC<BrandGuidelinesProps> = ({
  brandGuidelines,
  brandGuidelinesUploading,
  dragActive,
  activeClient,
  onDragOver,
  onDragLeave,
  onDrop,
  onUpload}) => {
  if (!brandGuidelines) {
    return (
      <Box
        sx={{
          border: '2px dashed',
          borderColor: dragActive ? 'primary.main' : 'grey.300',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50'  }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => document.getElementById('brand-guidelines-input')?.click()}
      >
        {' '}
        <input
          id="brand-guidelines-input"
          type="file"
          accept=".pdf,.docx,.txt"
          style={{ display: 'none' }}
          onChange={onUpload}
        />{' '}
        <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />{' '}
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {' '}
          {brandGuidelinesUploading
            ? 'Analyzing brand guidelines...'
            : 'Upload Brand Guidelines'}{' '}
        </Typography>{' '}
        <Typography variant="body2" color="text.secondary">
          {' '}
          Drag and drop or click to select a PDF, DOCX, or TXT file{' '}
        </Typography>{' '}
        {brandGuidelinesUploading && (
          <Box sx={{ mt: 2 }}>
            {' '}
            <LinearProgress />{' '}
          </Box>
        )}{' '}
      </Box>
    );
  }
  return (
    <Box>
      {' '}
      <Alert severity="success" sx={{ mb: 3 }}>
        {' '}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {' '}
          <CheckCircleIcon />{' '}
          <Typography variant="body2">
            {' '}
            Brand guidelines analyzed and saved for client: {activeClient?.name}{' '}
          </Typography>{' '}
        </Box>{' '}
      </Alert>{' '}
      <Grid container spacing={3}>
        {' '}
        {/* Colors */}{' '}
        <Grid size={{ md: 3, xs: 12 }}>
          {' '}
          <Card>
            {' '}
            <CardContent>
              {' '}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {' '}
                <PaletteIcon sx={{ mr: 1, color: 'primary.main' }} />{' '}
                <Typography variant="h6">Colors</Typography>{' '}
              </Box>{' '}
              {brandGuidelines.colors && (
                <>
      {' '}
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {' '}
                    Primary{' '}
                  </Typography>{' '}
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    {' '}
                    {Array.isArray(brandGuidelines.colors?.primary) &&
                      brandGuidelines.colors.primary.map((color: string, index: number) => (
                        <Box
                          key={index}
                          sx={{
                            width: 24,
                            height: 24,
                            bgcolor: color,
                            borderRadius: 1,
                            border: '1px solid #ccc' }}
                          title={color}
                        />
                      ))}{' '}
                  </Stack>{' '}
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {' '}
                    Secondary{' '}
                  </Typography>{' '}
                  <Stack direction="row" spacing={1}>
                    {' '}
                    {Array.isArray(brandGuidelines.colors?.secondary) &&
                      brandGuidelines.colors.secondary.map((color: string, index: number) => (
                        <Box
                          key={index}
                          sx={{
                            width: 24,
                            height: 24,
                            bgcolor: color,
                            borderRadius: 1,
                            border: '1px solid #ccc' }}
                          title={color}
                        />
                      ))}{' '}
                  </Stack>{' '}
                </>
              )}{' '}
            </CardContent>{' '}
          </Card>{' '}
        </Grid>{' '}
        {/* Typography */}{' '}
        <Grid size={{ md: 3, xs: 12 }}>
          {' '}
          <Card>
            {' '}
            <CardContent>
              {' '}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {' '}
                <TextFormatIcon sx={{ mr: 1, color: 'primary.main' }} />{' '}
                <Typography variant="h6">Typography</Typography>{' '}
              </Box>{' '}
              {brandGuidelines.typography && (
                <Box>
                  {' '}
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {' '}
                    Primary Font{' '}
                  </Typography>{' '}
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {' '}
                    {brandGuidelines.typography.primary_font}{' '}
                  </Typography>{' '}
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {' '}
                    Secondary Font{' '}
                  </Typography>{' '}
                  <Typography variant="body2">
                    {' '}
                    {brandGuidelines.typography.secondary_font}{' '}
                  </Typography>{' '}
                </Box>
              )}{' '}
            </CardContent>{' '}
          </Card>{' '}
        </Grid>{' '}
        {/* Voice & Tone */}{' '}
        <Grid size={{ md: 6, xs: 12 }}>
          {' '}
          <Card>
            {' '}
            <CardContent>
              {' '}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {' '}
                <VoiceOverOffIcon sx={{ mr: 1, color: 'primary.main' }} />{' '}
                <Typography variant="h6">Voice & Tone</Typography>{' '}
              </Box>{' '}
              {brandGuidelines.toneOfVoice && (
                <Box>
                  {' '}
                  <Typography variant="body2" color="text.secondary">
                    {' '}
                    {brandGuidelines.toneOfVoice.communication_style}{' '}
                  </Typography>{' '}
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    {' '}
                    {Array.isArray(brandGuidelines.toneOfVoice?.personality) &&
                      brandGuidelines.toneOfVoice.personality.map(
                        (trait: string, index: number) => (
                          <Box
                            key={index}
                            sx={{
                              px: 1,
                              py: 0.5,
                              bgcolor: 'primary.50',
                              borderRadius: 1,
                              fontSize: '0.75rem' }}
                          >
                            {' '}
                            {trait}{' '}
                          </Box>
                        )
                      )}{' '}
                  </Stack>{' '}
                </Box>
              )}{' '}
            </CardContent>{' '}
          </Card>{' '}
        </Grid>{' '}
      </Grid>{' '}
    </Box>
  );
};
export default BrandGuidelinesSection;
