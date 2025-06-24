import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  IconButton,
  Grid} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
interface Brief {
  id: string;
  title: string;
  type: 'campaign' | 'content' | 'product' | 'general';
  campaignId?: string;
  objective: string;
  targetAudience: string;
  keyMessages: string[];
  tone: string;
  deliverables: string[];
  timeline: string;
  budget?: string;
  additionalNotes?: string;
  status: 'draft' | 'submitted' | 'in_progress' | 'completed';
  dateCreated: string;
  lastModified: string;
}
interface BriefDialogProps {
  open: boolean;
  onClose: () => void;
  briefForm: any;
  setBriefForm: (form: any) => void;
  activeStep: number;
  setActiveStep: (step: number) => void;
  campaigns: any[];
  onSubmit: () => void;
}
const BriefDialog: React.FC<BriefDialogProps> = ({
  open,
  onClose,
  briefForm,
  setBriefForm,
  activeStep,
  setActiveStep,
  campaigns,
  onSubmit}) => {
  const steps = [
    'Basic Information',
    'Objectives & Audience',
    'Messages & Deliverables',
    'Timeline & Budget',
  ];
  const handleNext = () => {
    setActiveStep(activeStep + 1);
  };
  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };
  const addKeyMessage = () => {
    setBriefForm({ ...briefForm, keyMessages: [...briefForm.keyMessages, ''] });
  };
  const removeKeyMessage = (index: number) => {
    const newMessages = [...briefForm.keyMessages];
    newMessages.splice(index, 1);
    setBriefForm({ ...briefForm, keyMessages: newMessages });
  };
  const updateKeyMessage = (index: number, value: string) => {
    const newMessages = [...briefForm.keyMessages];
    newMessages[index] = value;
    setBriefForm({ ...briefForm, keyMessages: newMessages });
  };
  const addDeliverable = () => {
    setBriefForm({ ...briefForm, deliverables: [...briefForm.deliverables, ''] });
  };
  const removeDeliverable = (index: number) => {
    const newDeliverables = [...briefForm.deliverables];
    newDeliverables.splice(index, 1);
    setBriefForm({ ...briefForm, deliverables: newDeliverables });
  };
  const updateDeliverable = (index: number, value: string) => {
    const newDeliverables = [...briefForm.deliverables];
    newDeliverables[index] = value;
    setBriefForm({ ...briefForm, deliverables: newDeliverables });
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      {' '}
      <DialogTitle>Create New Brief</DialogTitle>{' '}
      <DialogContent>
        {' '}
        <Stepper activeStep={activeStep} orientation="vertical">
          {' '}
          <Step>
            {' '}
            <StepLabel>Basic Information</StepLabel>{' '}
            <StepContent>
              {' '}
              <Grid container spacing={2}>
                {' '}
                <Grid size={{ xs: 12 }}>
                  {' '}
                  <TextField
                    fullWidth
                    label="Brief Title"
                    value={briefForm.title}
                    onChange={e => setBriefForm({ ...briefForm, title: e.target.value })}
                    margin="normal"
                  />{' '}
                </Grid>{' '}
                <Grid size={{ xs: 12, sm: 6 }}>
                  {' '}
                  <FormControl fullWidth margin="normal">
                    {' '}
                    <InputLabel>Brief Type</InputLabel>{' '}
                    <Select
                      value={briefForm.type}
                      label="Brief Type"
                      onChange={e => setBriefForm({ ...briefForm, type: e.target.value })}
                    >
                      {' '}
                      <MenuItem value="campaign">Campaign</MenuItem>{' '}
                      <MenuItem value="content">Content</MenuItem>{' '}
                      <MenuItem value="product">Product</MenuItem>{' '}
                      <MenuItem value="general">General</MenuItem>{' '}
                    </Select>{' '}
                  </FormControl>{' '}
                </Grid>{' '}
                {briefForm.type === 'campaign' && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    {' '}
                    <FormControl fullWidth margin="normal">
                      {' '}
                      <InputLabel>Campaign</InputLabel>{' '}
                      <Select
                        value={briefForm.campaignId}
                        label="Campaign"
                        onChange={e => setBriefForm({ ...briefForm, campaignId: e.target.value })}
                      >
                        {' '}
                        {Array.isArray(campaigns) &&
                          campaigns.map((campaign: any) => (
                            <MenuItem key={campaign.id} value={campaign.id}>
                              {' '}
                              {campaign.name}{' '}
                            </MenuItem>
                          ))}{' '}
                      </Select>{' '}
                    </FormControl>{' '}
                  </Grid>
                )}{' '}
              </Grid>{' '}
              <Box sx={{ mb: 1, mt: 2 }}>
                {' '}
                <Button variant="contained" onClick={handleNext} sx={{ mr: 1 }}>
                  {' '}
                  Continue{' '}
                </Button>{' '}
              </Box>{' '}
            </StepContent>{' '}
          </Step>{' '}
          <Step>
            {' '}
            <StepLabel>Objectives & Audience</StepLabel>{' '}
            <StepContent>
              {' '}
              <TextField
                fullWidth
                label="Objective"
                multiline
                rows={3}
                value={briefForm.objective}
                onChange={e => setBriefForm({ ...briefForm, objective: e.target.value })}
                margin="normal"
              />{' '}
              <TextField
                fullWidth
                label="Target Audience"
                multiline
                rows={3}
                value={briefForm.targetAudience}
                onChange={e => setBriefForm({ ...briefForm, targetAudience: e.target.value })}
                margin="normal"
              />{' '}
              <Box sx={{ mb: 1, mt: 2 }}>
                {' '}
                <Button onClick={handleBack} sx={{ mr: 1 }}>
                  {' '}
                  Back{' '}
                </Button>{' '}
                <Button variant="contained" onClick={handleNext}>
                  {' '}
                  Continue{' '}
                </Button>{' '}
              </Box>{' '}
            </StepContent>{' '}
          </Step>{' '}
          <Step>
            {' '}
            <StepLabel>Messages & Deliverables</StepLabel>{' '}
            <StepContent>
              {' '}
              <Typography variant="subtitle2" gutterBottom>
                {' '}
                Key Messages{' '}
              </Typography>{' '}
              {briefForm.keyMessages.map((message: string, index: number) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  {' '}
                  <TextField
                    fullWidth
                    label={`Message ${index + 1}`}
                    value={message}
                    onChange={e => updateKeyMessage(index, e.target.value)}
                    sx={{ mr: 1 }}
                  />{' '}
                  <IconButton
                    onClick={() => removeKeyMessage(index)}
                    disabled={briefForm.keyMessages.length === 1}
                  >
                    {' '}
                    <DeleteIcon />{' '}
                  </IconButton>{' '}
                </Box>
              ))}{' '}
              <Button startIcon={<AddIcon />} onClick={addKeyMessage} size="small" sx={{ mb: 2 }}>
                {' '}
                Add Message{' '}
              </Button>{' '}
              <Typography variant="subtitle2" gutterBottom>
                {' '}
                Deliverables{' '}
              </Typography>{' '}
              {briefForm.deliverables.map((deliverable: string, index: number) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  {' '}
                  <TextField
                    fullWidth
                    label={`Deliverable ${index + 1}`}
                    value={deliverable}
                    onChange={e => updateDeliverable(index, e.target.value)}
                    sx={{ mr: 1 }}
                  />{' '}
                  <IconButton
                    onClick={() => removeDeliverable(index)}
                    disabled={briefForm.deliverables.length === 1}
                  >
                    {' '}
                    <DeleteIcon />{' '}
                  </IconButton>{' '}
                </Box>
              ))}{' '}
              <Button startIcon={<AddIcon />} onClick={addDeliverable} size="small">
                {' '}
                Add Deliverable{' '}
              </Button>{' '}
              <Box sx={{ mb: 1, mt: 2 }}>
                {' '}
                <Button onClick={handleBack} sx={{ mr: 1 }}>
                  {' '}
                  Back{' '}
                </Button>{' '}
                <Button variant="contained" onClick={handleNext}>
                  {' '}
                  Continue{' '}
                </Button>{' '}
              </Box>{' '}
            </StepContent>{' '}
          </Step>{' '}
          <Step>
            {' '}
            <StepLabel>Timeline & Budget</StepLabel>{' '}
            <StepContent>
              {' '}
              <Grid container spacing={2}>
                {' '}
                <Grid size={{ sm: 6, xs: 12 }}>
                  {' '}
                  <TextField
                    fullWidth
                    label="Timeline"
                    value={briefForm.timeline}
                    onChange={e => setBriefForm({ ...briefForm, timeline: e.target.value })}
                    margin="normal"
                  />{' '}
                </Grid>{' '}
                <Grid size={{ sm: 6, xs: 12 }}>
                  {' '}
                  <TextField
                    fullWidth
                    label="Budget"
                    value={briefForm.budget}
                    onChange={e => setBriefForm({ ...briefForm, budget: e.target.value })}
                    margin="normal"
                  />{' '}
                </Grid>{' '}
                <Grid size={{ xs: 12 }}>
                  {' '}
                  <TextField
                    fullWidth
                    label="Tone"
                    value={briefForm.tone}
                    onChange={e => setBriefForm({ ...briefForm, tone: e.target.value })}
                    margin="normal"
                  />{' '}
                </Grid>{' '}
                <Grid size={{ xs: 12 }}>
                  {' '}
                  <TextField
                    fullWidth
                    label="Additional Notes"
                    multiline
                    rows={3}
                    value={briefForm.additionalNotes}
                    onChange={e => setBriefForm({ ...briefForm, additionalNotes: e.target.value })}
                    margin="normal"
                  />{' '}
                </Grid>{' '}
              </Grid>{' '}
              <Box sx={{ mb: 1, mt: 2 }}>
                {' '}
                <Button onClick={handleBack} sx={{ mr: 1 }}>
                  {' '}
                  Back{' '}
                </Button>{' '}
                <Button variant="contained" onClick={onSubmit}>
                  {' '}
                  Create Brief{' '}
                </Button>{' '}
              </Box>{' '}
            </StepContent>{' '}
          </Step>{' '}
        </Stepper>{' '}
      </DialogContent>{' '}
    </Dialog>
  );
};
export default BriefDialog;
