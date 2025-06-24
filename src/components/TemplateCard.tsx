import React, { useState } from 'react';
import {
  Card,
  Box,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CardContent,
  Typography,
  Button,
  Chip,
  Grid} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  AspectRatio as AspectRatioIcon,
  Instagram as InstagramIcon,
  Facebook as FacebookIcon,
  Twitter as TwitterIcon,
  YouTube as YouTubeIcon,
  LinkedIn as LinkedInIcon,
  Pinterest as PinterestIcon} from '@mui/icons-material';
import { Template } from '@/types/models';
const platformIcons: Record<string, React.ReactNode> = {
  Instagram: <InstagramIcon sx={{ color: '#E1306C' }} />,
  Facebook: <FacebookIcon sx={{ color: '#1877F2' }} />,
  Twitter: <TwitterIcon sx={{ color: '#1DA1F2' }} />,
  YouTube: <YouTubeIcon sx={{ color: '#FF0000' }} />,
  LinkedIn: <LinkedInIcon sx={{ color: '#0A66C2' }} />,
  Pinterest: <PinterestIcon sx={{ color: '#E60023' }} />,
  TikTok: <AspectRatioIcon sx={{ color: '#000000' }} /> };
interface TemplateCardProps {
  template: Template;
  onEdit: (template: Template) => void;
  onDelete: (templateId: string) => void;
  onDuplicate: (template: Template) => void;
  onCreateMatrix: (templateId: string) => void;
}
const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onEdit,
  onDelete,
  onDuplicate,
  onCreateMatrix}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {' '}
      <Box
        sx={{
          height: 180,
          bgcolor: 'grey.200',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative' }}
      >
        {' '}
        {platformIcons[template.platform] || (
          <AspectRatioIcon sx={{ fontSize: 48, color: 'grey.400' }} />
        )}{' '}
        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
          {' '}
          <IconButton
            aria-label="more"
            id={`template-menu-${template.id}`}
            aria-controls={open ? `template-menu-${template.id}` : undefined}
            aria-expanded={open ? 'true' : undefined}
            aria-haspopup="true"
            onClick={handleClick}
            size="small"
          >
            {' '}
            <MoreIcon />{' '}
          </IconButton>{' '}
          <Menu
            id={`template-menu-${template.id}`}
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            MenuListProps={{ 'aria-labelledby': `template-menu-${template.id}` }}
          >
            {' '}
            <MenuItem
              onClick={() => {
                handleClose();
                onEdit(template);
              }}
            >
              {' '}
              <ListItemIcon>
                {' '}
                <EditIcon fontSize="small" />{' '}
              </ListItemIcon>{' '}
              <ListItemText>Edit</ListItemText>{' '}
            </MenuItem>{' '}
            <MenuItem
              onClick={() => {
                handleClose();
                onDuplicate(template);
              }}
            >
              {' '}
              <ListItemIcon>
                {' '}
                <DuplicateIcon fontSize="small" />{' '}
              </ListItemIcon>{' '}
              <ListItemText>Duplicate</ListItemText>{' '}
            </MenuItem>{' '}
            <MenuItem
              onClick={() => {
                handleClose();
                onDelete(template.id);
              }}
            >
              {' '}
              <ListItemIcon>
                {' '}
                <DeleteIcon fontSize="small" />{' '}
              </ListItemIcon>{' '}
              <ListItemText>Delete</ListItemText>{' '}
            </MenuItem>{' '}
          </Menu>{' '}
        </Box>{' '}
      </Box>{' '}
      <CardContent sx={{ flexGrow: 1 }}>
        {' '}
        <Typography variant="h6" component="div" gutterBottom noWrap>
          {' '}
          {template.name}{' '}
        </Typography>{' '}
        <Grid container spacing={1} sx={{ mb: 1 }}>
          {' '}
          <Grid size={{ xs: 6 }}>
            {' '}
            <Chip
              size="small"
              icon={platformIcons[template.platform] as React.ReactElement}
              label={template.platform}
            />{' '}
          </Grid>{' '}
          <Grid size={{ xs: 6 }}>
            {' '}
            <Chip size="small" icon={<AspectRatioIcon />} label={template.aspectRatio} />{' '}
          </Grid>{' '}
        </Grid>{' '}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {' '}
          {template.description}{' '}
        </Typography>{' '}
        <Grid container spacing={1}>
          {' '}
          <Grid size={{ xs: 12 }}>
            {' '}
            <Button
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              onClick={() => onCreateMatrix(template.id)}
              sx={{ mb: 1, fontWeight: 'bold', py: 1 }}
            >
              {' '}
              SELECT{' '}
            </Button>{' '}
          </Grid>{' '}
          <Grid size={{ xs: 6 }}>
            {' '}
            <Button variant="outlined" fullWidth onClick={() => onCreateMatrix(template.id)}>
              {' '}
              Use Template{' '}
            </Button>{' '}
          </Grid>{' '}
          <Grid size={{ xs: 6 }}>
            {' '}
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                window.open(`/preview?templateId=${template.id}`, '_blank');
              }}
            >
              {' '}
              Preview{' '}
            </Button>{' '}
          </Grid>{' '}
        </Grid>{' '}
      </CardContent>{' '}
      <Box sx={{ p: 2, pt: 0 }}>
        {' '}
        <Typography variant="caption" color="text.secondary">
          {' '}
          Last modified: {template.lastModified}{' '}
        </Typography>{' '}
      </Box>{' '}
    </Card>
  );
};
export default TemplateCard;
