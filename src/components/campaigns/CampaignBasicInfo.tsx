import React from 'react';
import { TextField, Box, Button, Typography, Grid } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
interface CampaignBasicInfoProps {
  campaignData: any;
  setCampaignData: (data: any) => void;
  onNext: () => void;
}
const CampaignBasicInfo: React.FC<CampaignBasicInfoProps> = ({
  campaignData,
  setCampaignData,
  onNext}) => {
  const handleChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setCampaignData({ ...campaignData, [field]: event.target.value });
  };
  const isValid = campaignData.name && campaignData.objective;
  return (
    <Box>
      {' '}
      <Typography variant="h6" gutterBottom>
        {' '}
        Campaign Basics{' '}
      </Typography>{' '}
      <Typography variant="body2" color="text.secondary" paragraph>
        {' '}
        Set up the fundamental information for your campaign.{' '}
      </Typography>{' '}
      <Grid container spacing={3}>
        {' '}
        <Grid size={{ xs: 12 }}>
          {' '}
          <TextField
            fullWidth
            label="Campaign Name"
            value={campaignData.name}
            onChange={handleChange('name')}
            placeholder="Enter a descriptive name for your campaign"
            required
          />{' '}
        </Grid>{' '}
        <Grid size={{ xs: 12 }}>
          {' '}
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Campaign Objective"
            value={campaignData.objective}
            onChange={handleChange('objective')}
            placeholder="Describe the main goal and purpose of this campaign"
            required
          />{' '}
        </Grid>{' '}
        <Grid size={{ md: 6, xs: 12 }}>
          {' '}
          <TextField
            fullWidth
            label="Target Audience"
            value={campaignData.targetAudience}
            onChange={handleChange('targetAudience')}
            placeholder="Who is this campaign targeting?"
          />{' '}
        </Grid>{' '}
        <Grid size={{ md: 6, xs: 12 }}>
          {' '}
          <TextField
            fullWidth
            label="Budget"
            value={campaignData.budget}
            onChange={handleChange('budget')}
            placeholder="Campaign budget (optional)"
          />{' '}
        </Grid>{' '}
      </Grid>{' '}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        {' '}
        <Button
          variant="contained"
          onClick={onNext}
          disabled={!isValid}
          endIcon={<ArrowForwardIcon />}
        >
          {' '},
  Next: Platforms{' '}
        </Button>{' '}
      </Box>{' '}
    </Box>
  );
};
export default CampaignBasicInfo;
