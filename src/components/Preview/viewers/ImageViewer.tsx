/**
 * Image Viewer Component
 * 
 * Advanced image viewer with:
 * - Zoom in/out (scroll wheel or buttons)
 * - Pan (drag when zoomed)
 * - Rotate 90° clockwise
 * - Fit to screen / Actual size toggle
 * - EXIF data display (future)
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, Move } from 'lucide-react';
import { ViewerBaseProps, ImageMetadata } from '../types';

interface ImageViewerProps extends ViewerBaseProps {
    className?: string;
}

// Zoom limits
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

export const ImageViewer: React.FC<ImageViewerProps> = ({
    file,
    onError,
    className = '',
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    // View state
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isFitToScreen, setIsFitToScreen] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [metadata, setMetadata] = useState<ImageMetadata | null>(null);

    // Image source URL
    const imageSrc = file.blobUrl || file.content as string || '';

    // Track previous src to avoid resetting on initial load
    const prevSrcRef = React.useRef<string>(imageSrc);

    // Reset state only when switching to a DIFFERENT image (not on initial load)
    useEffect(() => {
        // Only reset if we had a previous image and it's different
        if (prevSrcRef.current && prevSrcRef.current !== imageSrc && imageSrc) {
            setZoom(1);
            setRotation(0);
            setPosition({ x: 0, y: 0 });
            setIsFitToScreen(true);
            setImageLoaded(false);
            setImageError(false);
            setMetadata(null);
        }
        prevSrcRef.current = imageSrc;
    }, [imageSrc]);

    // Handle image load
    const handleImageLoad = useCallback(() => {
        // Set loaded first to hide spinner
        setImageLoaded(true);
        // Then extract metadata
        if (imageRef.current) {
            setMetadata({
                width: imageRef.current.naturalWidth,
                height: imageRef.current.naturalHeight,
                format: file.name.split('.').pop()?.toUpperCase() || 'Unknown',
            });
        }
    }, [file.name]);

    // Handle image error
    const handleImageError = useCallback(() => {
        setImageError(true);
        onError?.('Failed to load image');
    }, [onError]);

    // Zoom controls
    const zoomIn = useCallback(() => {
        setZoom(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
        setIsFitToScreen(false);
    }, []);

    const zoomOut = useCallback(() => {
        setZoom(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
        setIsFitToScreen(false);
    }, []);

    // Rotate 90° clockwise
    const rotate = useCallback(() => {
        setRotation(prev => (prev + 90) % 360);
    }, []);

    // Toggle fit to screen
    const toggleFit = useCallback(() => {
        if (isFitToScreen) {
            setZoom(1);
            setPosition({ x: 0, y: 0 });
        } else {
            setZoom(1);
            setPosition({ x: 0, y: 0 });
        }
        setIsFitToScreen(!isFitToScreen);
    }, [isFitToScreen]);

    // Mouse wheel zoom
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
        setIsFitToScreen(false);
    }, []);

    // Drag handlers for panning
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (zoom > 1 || !isFitToScreen) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    }, [zoom, isFitToScreen, position]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        }
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Render loading state
    if (!imageSrc) {
        return (
            <div className={`flex items-center justify-center h-full bg-gray-900 ${className}`}>
                <div className="text-gray-500">No image data available</div>
            </div>
        );
    }

    return (
        <div className={`relative flex flex-col h-full bg-gray-900 ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800/80 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    {/* Zoom controls */}
                    <button
                        onClick={zoomOut}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut size={18} className="text-gray-400" />
                    </button>
                    <span className="text-sm text-gray-400 w-16 text-center font-mono">
                        {Math.round(zoom * 100)}%
                    </span>
                    <button
                        onClick={zoomIn}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn size={18} className="text-gray-400" />
                    </button>

                    <div className="w-px h-6 bg-gray-700 mx-2" />

                    {/* Rotate */}
                    <button
                        onClick={rotate}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Rotate 90°"
                    >
                        <RotateCw size={18} className="text-gray-400" />
                    </button>

                    {/* Fit toggle */}
                    <button
                        onClick={toggleFit}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title={isFitToScreen ? 'Actual Size' : 'Fit to Screen'}
                    >
                        {isFitToScreen ? (
                            <Maximize2 size={18} className="text-gray-400" />
                        ) : (
                            <Minimize2 size={18} className="text-gray-400" />
                        )}
                    </button>
                </div>

                {/* Image info */}
                {metadata && (
                    <div className="text-xs text-gray-500 font-mono">
                        {metadata.width} × {metadata.height} • {metadata.format}
                    </div>
                )}
            </div>

            {/* Image container */}
            <div
                ref={containerRef}
                className={`flex-1 overflow-hidden flex items-center justify-center ${isDragging ? 'cursor-grabbing' : zoom > 1 ? 'cursor-grab' : 'cursor-default'
                    }`}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {/* Loading indicator */}
                {!imageLoaded && !imageError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* Error state */}
                {imageError && (
                    <div className="text-red-400 text-center">
                        <div className="text-4xl mb-2">⚠️</div>
                        <div>Failed to load image</div>
                    </div>
                )}

                {/* Image */}
                <img
                    ref={imageRef}
                    src={imageSrc}
                    alt={file.name}
                    className={`max-w-full max-h-full transition-opacity duration-300 select-none ${imageLoaded ? 'opacity-100' : 'opacity-0'
                        }`}
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                        transformOrigin: 'center center',
                        objectFit: isFitToScreen ? 'contain' : 'none',
                    }}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    draggable={false}
                />
            </div>

            {/* Pan indicator when zoomed */}
            {zoom > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-gray-800/90 rounded-full text-xs text-gray-400">
                    <Move size={14} />
                    <span>Drag to pan</span>
                </div>
            )}
        </div>
    );
};

export default ImageViewer;
