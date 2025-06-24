// Image optimization configuration
export const imageOptimizationConfig = {
  formats: ['image/webp', 'image/avif'],
  quality: 80,
  sizes: [16, 32, 48, 64, 96, 128, 256, 384],
  domains: ['localhost', process.env.NEXT_PUBLIC_DOMAIN]};

// Optimize image component
import Image from 'next/image';

interface OptimizedImageProps {
  src: string;
  alt: string;
  priority?: boolean;
  [key: string]: any;
}

export const OptimizedImage = ({ src, alt, ...props }: OptimizedImageProps) => (
  <Image
    src={src}
    alt={alt}
    placeholder="blur"
    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSoAPTGiahJ2UJC5O7yGBVXcXB7LzRPLaEsn7dbyM7jWN8DhC7O7jI8e0XcZ3uK2Pnx9M8f6FwYHgFfCKqMTTmk="
    priority={props.priority}
    {...props}
  />
);
