import React, { useState, useEffect, useMemo, useCallback } from 'react';

const Avatar = ({ 
  src, 
  fallback, 
  size = "md", 
  cacheKey,
  alt = "User avatar",
  className = "",
  onClick,
  variant = "circle",
  status = null
}) => {
  // Size configurations - expanded for more flexibility
  const sizes = useMemo(() => ({
    xs: "w-6 h-6",
    sm: "w-8 h-8", 
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
    "2xl": "w-20 h-20"
  }), []);

  const textSizes = useMemo(() => ({
    xs: "text-xs",
    sm: "text-xs", 
    md: "text-sm",
    lg: "text-sm",
    xl: "text-base",
    "2xl": "text-lg"
  }), []);

  // Variant styles
  const variantStyles = useMemo(() => ({
    circle: "rounded-full",
    square: "rounded-lg",
    rounded: "rounded-md"
  }), []);

  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState(Date.now());

  // Memoize the final src to avoid unnecessary recalculations
  const finalSrc = useMemo(() => {
    if (!src) return null;

    // If it's already a full URL or data URL, return as-is with cache-busting
    if (src.startsWith('http') || src.startsWith('data:')) {
      const separator = src.includes('?') ? '&' : '?';
      return `${src}${separator}_t=${cacheTimestamp}`;
    }

    // Handle relative paths
    const filename = src.startsWith('/uploads/') ? src.replace('/uploads/', '') : src;
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
    return `${baseUrl}/uploads/${encodeURIComponent(filename)}?_t=${cacheTimestamp}`;
  }, [src, cacheTimestamp]);

  // Memoize fallback text to avoid recalculations
  const fallbackText = useMemo(() => {
    if (!fallback) return '?';
    // Take first 2 characters for better visual balance
    return fallback.slice(0, 2).toUpperCase();
  }, [fallback]);

  // Reset states when src or cacheKey changes
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
    setCacheTimestamp(Date.now());
  }, [src, cacheKey]);

  // Optimized event handlers
  const handleImageLoad = useCallback(() => {
    setImgLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImgError(true);
  }, []);

  // Show fallback if no src or image failed to load
  if (!src || imgError) {
    return (
      <div 
        className={`
          ${sizes[size]} 
          ${variantStyles[variant]} 
          bg-gradient-to-br from-slate-100 to-slate-200 
          border border-slate-300 
          flex items-center justify-center 
          overflow-hidden 
          relative
          shadow-sm
          transition-all duration-200
          hover:shadow-md
          ${onClick ? 'cursor-pointer' : ''}
          ${className}
        `}
        onClick={onClick}
        role="img"
        aria-label={alt}
      >
        <span className={`font-semibold text-slate-600 ${textSizes[size]} select-none`}>
          {fallbackText}
        </span>
        
        {/* Status indicator */}
        {status && (
          <div 
            className={`
              absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white
              ${status === 'online' ? 'bg-green-500' : ''}
              ${status === 'away' ? 'bg-yellow-500' : ''}
              ${status === 'busy' ? 'bg-red-500' : ''}
              ${status === 'offline' ? 'bg-gray-400' : ''}
            `}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
    );
  }

  return (
    <div 
      className={`
        ${sizes[size]} 
        ${variantStyles[variant]} 
        bg-slate-100 
        border border-slate-200 
        flex items-center justify-center 
        overflow-hidden 
        relative
        shadow-sm
        transition-all duration-200
        hover:shadow-md
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Show fallback while image is loading */}
      {!imgLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <span className={`font-semibold text-slate-600 ${textSizes[size]} select-none`}>
            {fallbackText}
          </span>
        </div>
      )}

      {/* Optimized image with proper loading */}
      <img
        src={finalSrc}
        alt={alt}
        className={`
          w-full h-full 
          object-cover 
          transition-opacity duration-300 
          ${imgLoaded ? 'opacity-100' : 'opacity-0'}
        `}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        decoding="async"
        style={{ imageRendering: 'auto' }}
      />
      
      {/* Status indicator for loaded images */}
      {status && imgLoaded && (
        <div 
          className={`
            absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white
            ${status === 'online' ? 'bg-green-500' : ''}
            ${status === 'away' ? 'bg-yellow-500' : ''}
            ${status === 'busy' ? 'bg-red-500' : ''}
            ${status === 'offline' ? 'bg-gray-400' : ''}
          `}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
};

export default React.memo(Avatar);
