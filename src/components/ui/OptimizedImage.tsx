import React, { useState } from 'react';
import Image from 'next/image';
import { Box, Skeleton, IconButton } from '@mui/material';
import { BrokenImage as BrokenImageIcon } from '@mui/icons-material';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  fill = false,
  priority = false,
  quality = 75,
  className,
  style,
  onLoad,
  onError,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  if (hasError) {
    return (
      <Box
        sx={{
          width: fill ? '100%' : width,
          height: fill ? '100%' : height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.100',
          border: '1px dashed',
          borderColor: 'grey.300',
          borderRadius: 1 }}
      >
        <IconButton disabled>
          <BrokenImageIcon color="disabled" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box
      sx={{ position: 'relative', width: fill ? '100%' : width, height: fill ? '100%' : height }}
    >
      {isLoading && (
        <Skeleton
          variant="rectangular"
          width={fill ? '100%' : width || 200}
          height={fill ? '100%' : height || 200}
          sx={{
            position: fill ? 'absolute' : 'static',
            top: 0,
            left: 0,
            zIndex: 1 }}
        />
      )}

      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        quality={quality}
        className={className}
        style={{
          ...style,
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out' }}
        onLoad={handleLoad}
        onError={handleError}
      />
    </Box>
  );
};

export default OptimizedImage;
