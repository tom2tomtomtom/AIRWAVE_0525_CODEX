import React from 'react';
import Head from 'next/head';
import { Box, Grid, Card, CardContent, Typography } from '@mui/material';

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
  aspectRatio: string;
  description: string;
  thumbnail: string;
  dateCreated: string;
  lastModified: string;
  category: string;
  industry: string;
  contentType: string;
  dimensions: string;
  recommendedUsage: string;
  usageCount: number;
  performance?: {
    views: number;
    engagement: number;
    conversion: number;
    score: number;
  };
  dynamicFields: DynamicField[];
  isCreatomate: boolean;
  creatomateId: string;
}

const mockTemplates: Template[] = [
  {
    id: 't1',
    name: 'Instagram Story',
    platform: 'Instagram',
    aspectRatio: '9:16',
    description: 'Vertical template optimized for Instagram Stories with dynamic text and image placement',
    thumbnail: '/instagram-story.jpg',
    dateCreated: '2023-04-15',
    lastModified: '2023-05-01',
    category: 'Social Media',
    industry: 'Health & Fitness',
    contentType: 'Story',
    dimensions: '1080x1920',
    recommendedUsage: 'Brand awareness, product showcases, behind-the-scenes content',
    usageCount: 245,
    performance: {
      views: 12500,
      engagement: 8.7,
      conversion: 3.2,
      score: 85,
    },
    dynamicFields: [
      {
        id: 'df1',
        name: 'Headline',
        type: 'text',
        required: true,
        description: 'Main headline text (max 40 characters)',
      },
      {
        id: 'df2',
        name: 'Background Image',
        type: 'image',
        required: true,
        description: 'Full screen background image (1080x1920)',
      },
      {
        id: 'df3',
        name: 'Call to Action',
        type: 'text',
        required: false,
        description: 'Optional call to action text',
      },
    ],
    isCreatomate: true,
    creatomateId: 'crt-123456',
  },
  {
    id: 't2',
    name: 'Facebook Post',
    platform: 'Facebook',
    aspectRatio: '1:1',
    description: 'Square template for Facebook feed posts with text overlay and product image',
    thumbnail: '/facebook-post.jpg',
    dateCreated: '2023-04-10',
    lastModified: '2023-04-28',
    category: 'Social Media',
    industry: 'E-commerce',
    contentType: 'Post',
    dimensions: '1080x1080',
    recommendedUsage: 'Product promotions, announcements, engagement posts',
    usageCount: 189,
    performance: {
      views: 8700,
      engagement: 5.2,
      conversion: 2.1,
      score: 72,
    },
    dynamicFields: [
      {
        id: 'df1',
        name: 'Product Image',
        type: 'image',
        required: true,
        description: 'Main product image (1:1 ratio recommended)',
      },
      {
        id: 'df2',
        name: 'Headline',
        type: 'text',
        required: true,
        description: 'Main headline text (max 60 characters)',
      },
      {
        id: 'df3',
        name: 'Description',
        type: 'text',
        required: true,
        description: 'Product description (max 120 characters)',
      },
      {
        id: 'df4',
        name: 'Price',
        type: 'text',
        required: false,
        description: 'Product price',
      },
      {
        id: 'df5',
        name: 'Background Color',
        type: 'color',
        required: false,
        description: 'Background color for the post',
      },
    ],
    isCreatomate: true,
    creatomateId: 'crt-234567',
  },
  {
    id: 't3',
    name: 'YouTube Thumbnail',
    platform: 'YouTube',
    aspectRatio: '16:9',
    description: 'Thumbnail template for YouTube videos with text overlay and background image',
    thumbnail: '/youtube-thumbnail.jpg',
    dateCreated: '2023-04-05',
    lastModified: '2023-04-20',
    category: 'Video',
    industry: 'Education',
    contentType: 'Thumbnail',
    dimensions: '1280x720',
    recommendedUsage: 'Video thumbnails, course previews',
    usageCount: 156,
    performance: {
      views: 9500,
      engagement: 6.8,
      conversion: 3.5,
      score: 80,
    },
    dynamicFields: [
      {
        id: 'df1',
        name: 'Background Image',
        type: 'image',
        required: true,
        description: 'Background image (16:9 ratio)',
      },
      {
        id: 'df2',
        name: 'Title Text',
        type: 'text',
        required: true,
        description: 'Main title text (max 50 characters)',
      },
      {
        id: 'df3',
        name: 'Subtitle',
        type: 'text',
        required: false,
        description: 'Subtitle or additional text',
      },
      {
        id: 'df4',
        name: 'Logo',
        type: 'image',
        required: false,
        description: 'Channel or brand logo',
      },
    ],
    isCreatomate: true,
    creatomateId: 'crt-345678',
  },
];

const MatrixPage = () => (
  <>
    <Head>
      <title>Matrix</title>
    </Head>
    <Box p={2}>
      <Grid container spacing={2}>
        {mockTemplates.map((t) => (
          <Grid item xs={12} md={6} lg={4} key={t.id}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  </>
);

export default MatrixPage;
