import React from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ArrowBack as ArrowBackIcon, ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
interface CampaignScheduleProps {
  campaignData: any;
  setCampaignData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}
const CampaignSchedule: React.FC<CampaignScheduleProps> = ({
  campaignData,
  setCampaignData,
  onNext,
  onBack}) => {
  const handleDateChange = (field: string) => (date: Date | null) => {
    setCampaignData({ ...campaignData, [field]: date });
  };
  const handleChange = (field: string) => (event: any) => {
    setCampaignData({ ...campaignData, [field]: event.target.value });
  };
  const isValid = campaignData.startDate && campaignData.endDate;
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      {' '}
      <Box>
        {' '}
        <Typography variant="h6" gutterBottom>
          {' '}
          Campaign Schedule{' '}
        </Typography>{' '}
        <Typography variant="body2" color="text.secondary" paragraph>
          {' '}
          Set the timeline and frequency for your campaign.{' '}
        </Typography>{' '}
        <Grid container spacing={3}>
          {' '}
          <Grid size={{ md: 6, xs: 12 }}>
            {' '}
            <DatePicker
              label="Start Date"
              value={campaignData.startDate}
              onChange={handleDateChange('startDate')}
              slotProps={{ textField: { fullWidth: true, required: true } }}
            />{' '}
          </Grid>{' '}
          <Grid size={{ md: 6, xs: 12 }}>
            {' '}
            <DatePicker
              label="End Date"
              value={campaignData.endDate}
              onChange={handleDateChange('endDate')}
              slotProps={{ textField: { fullWidth: true, required: true } }}
            />{' '}
          </Grid>{' '}
          <Grid size={{ md: 6, xs: 12 }}>
            {' '}
            <FormControl fullWidth>
              {' '}
              <InputLabel>Posting Frequency</InputLabel>{' '}
              <Select
                value={campaignData.frequency || ''}
                label="Posting Frequency"
                onChange={handleChange('frequency')}
              >
                {' '}
                <MenuItem value="daily">Daily</MenuItem>{' '}
                <MenuItem value="every-other-day">Every Other Day</MenuItem>{' '}
                <MenuItem value="weekly">Weekly</MenuItem>{' '}
                <MenuItem value="bi-weekly">Bi-weekly</MenuItem>{' '}
                <MenuItem value="custom">Custom</MenuItem>{' '}
              </Select>{' '}
            </FormControl>{' '}
          </Grid>{' '}
          <Grid size={{ md: 6, xs: 12 }}>
            {' '}
            <TextField
              fullWidth
              label="Estimated Posts"
              type="number"
              value={campaignData.estimatedPosts || ''}
              onChange={handleChange('estimatedPosts')}
              placeholder="Total number of posts"
            />{' '}
          </Grid>{' '}
          <Grid size={{ xs: 12 }}>
            {' '}
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Additional Notes"
              value={campaignData.notes || ''}
              onChange={handleChange('notes')}
              placeholder="Any additional information about the campaign schedule"
            />{' '}
          </Grid>{' '}
        </Grid>{' '}
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
          {' '}
          <Button variant="outlined" onClick={onBack} startIcon={<ArrowBackIcon />}>
            {' '}
            Back{' '}
          </Button>{' '}
          <Button
            variant="contained"
            onClick={onNext}
            disabled={!isValid}
            endIcon={<ArrowForwardIcon />}
          >
            {' '}
            Create Campaign{' '}
          </Button>{' '}
        </Box>{' '}
      </Box>{' '}
    </LocalizationProvider>
  );
};
export default CampaignSchedule;
