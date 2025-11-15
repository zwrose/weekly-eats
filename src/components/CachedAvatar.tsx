"use client";

import { useState } from "react";
import { Avatar, AvatarProps } from "@mui/material";
import AccountCircle from "@mui/icons-material/AccountCircle";

interface CachedAvatarProps extends Omit<AvatarProps, 'src' | 'imgProps'> {
  src?: string | null;
  alt: string;
  fallbackIcon?: React.ReactNode;
  useProxy?: boolean; // Whether to use the proxy API route
}

/**
 * Avatar component with error handling for Google profile images.
 * Prevents 429 rate limiting errors by:
 * 1. Using a proxy API route that adds proper caching
 * 2. Caching failed images in component state
 * 3. Falling back to default icon on error
 */
export const CachedAvatar: React.FC<CachedAvatarProps> = ({
  src,
  alt,
  fallbackIcon,
  useProxy = true,
  sx,
  ...props
}) => {
  const [imageError, setImageError] = useState(false);

  // If no src or error occurred, show fallback
  if (!src || imageError) {
    return (
      <Avatar
        {...props}
        sx={sx}
      >
        {fallbackIcon || <AccountCircle />}
      </Avatar>
    );
  }

  // Use proxy API route for Google images to add caching and handle 429 errors
  const imageSrc = useProxy && src.startsWith('https://lh3.googleusercontent.com/')
    ? `/api/avatar?url=${encodeURIComponent(src)}`
    : src;

  return (
    <Avatar
      {...props}
      src={imageSrc}
      alt={alt}
      sx={sx}
      imgProps={{
        onError: () => {
          // Set error state to prevent retrying on every render
          setImageError(true);
        },
        loading: 'lazy',
      }}
    />
  );
};

