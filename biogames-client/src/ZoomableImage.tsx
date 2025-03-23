import React, { useState, useRef, useEffect, WheelEvent, MouseEvent } from 'react';

interface ZoomableImageProps {
  src: string;
  alt?: string;
  className?: string;
  maxZoom?: number;
}

function ZoomableImage({ src, alt = '', className = '', maxZoom = 4 }: ZoomableImageProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom and position when src changes
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [src]);

  const handleZoomIn = () => {
    setZoom(prevZoom => Math.min(prevZoom + 0.5, maxZoom));
  };

  const handleZoomOut = () => {
    if (zoom > 1) {
      setZoom(prevZoom => Math.max(prevZoom - 0.5, 1));
      // Reset position if zooming back to 1
      if (zoom <= 1.5) {
        setPosition({ x: 0, y: 0 });
      }
    }
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && zoom > 1) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Clean up event listeners
  useEffect(() => {
    const handleMouseUpGlobal = () => {
      setIsDragging(false);
    };
    
    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => {
      window.removeEventListener('mouseup', handleMouseUpGlobal);
    };
  }, []);

  return (
    <div className="relative" style={{ overflow: 'hidden' }}>
      <div 
        ref={containerRef}
        className={`${className} overflow-hidden relative`} 
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img 
          src={src} 
          alt={alt}
          className="transition-transform duration-100 ease-out"
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            transformOrigin: 'center',
            maxWidth: '100%',
            maxHeight: '75vh'
          }}
          draggable="false"
        />
      </div>
      
      {/* Zoom controls */}
      <div className="absolute bottom-2 right-2 flex gap-2 bg-black/50 p-2 rounded text-white">
        <button 
          onClick={handleZoomOut}
          className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded"
          disabled={zoom <= 1}
        >
          <i className="fa fa-minus"></i>
        </button>
        <button 
          onClick={handleReset}
          className="px-2 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded"
        >
          <span>{Math.round(zoom * 100)}%</span>
        </button>
        <button 
          onClick={handleZoomIn}
          className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded"
          disabled={zoom >= maxZoom}
        >
          <i className="fa fa-plus"></i>
        </button>
      </div>
    </div>
  );
}

export default ZoomableImage; 