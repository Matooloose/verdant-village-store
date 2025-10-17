import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, GripVertical, X, Move } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import './movable-search.css';

interface MovableQuickSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  onClose?: () => void;
  className?: string;
}

interface Position {
  x: number;
  y: number;
}

const MovableQuickSearch: React.FC<MovableQuickSearchProps> = ({
  searchTerm,
  onSearchChange,
  placeholder = "Quick search...",
  onClose,
  className = ""
}) => {
  const [position, setPosition] = useState<Position>({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [dragStarted, setDragStarted] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Load saved position from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem('movableSearchPosition');
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        setPosition(parsed);
      } catch (error) {
        console.log('Error loading saved position:', error);
      }
    }
  }, []);

  // Save position to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('movableSearchPosition', JSON.stringify(position));
  }, [position]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!searchRef.current || !dragHandleRef.current) return;
    
    const rect = searchRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
    setDragStarted(true);
    document.body.style.userSelect = 'none'; // Prevent text selection during drag
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!searchRef.current || !dragHandleRef.current) return;
    
    const rect = searchRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    });
    setIsDragging(true);
    setDragStarted(true);
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Keep within screen bounds
    const maxX = window.innerWidth - 300; // Approximate width of search box
    const maxY = window.innerHeight - 60; // Approximate height of search box
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  }, [isDragging, dragOffset]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const newX = touch.clientX - dragOffset.x;
    const newY = touch.clientY - dragOffset.y;
    
    // Keep within screen bounds
    const maxX = window.innerWidth - 300; // Approximate width of search box
    const maxY = window.innerHeight - 60; // Approximate height of search box
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
    e.preventDefault();
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStarted(false);
    document.body.style.userSelect = ''; // Restore text selection
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setDragStarted(false);
  }, []);

  // Add event listeners for mouse/touch events
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const focusInput = () => {
    if (!isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Update CSS custom properties for positioning
  useEffect(() => {
    if (searchRef.current) {
      searchRef.current.style.setProperty('--search-x', `${position.x}px`);
      searchRef.current.style.setProperty('--search-y', `${position.y}px`);
    }
  }, [position]);

  return (
    <div
      ref={searchRef}
      className={`movable-search-container ${isDragging ? 'dragging' : ''} ${className}`}
    >
      <Card className={`movable-search-card bg-background/95 shadow-xl transition-all duration-200 ${
        isMinimized ? 'movable-search-minimized' : 'movable-search-expanded'
      } ${isDragging ? 'shadow-2xl dragging' : ''}`}>
        {isMinimized ? (
          // Minimized state - just the search icon with drag handle
          <div className="flex items-center justify-center w-full h-full relative">
            <div
              ref={dragHandleRef}
              className="movable-search-drag-handle absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-muted/50 rounded-lg"
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onClick={toggleMinimize}
              title="Click to expand, drag to move"
            >
              <Search className="h-5 w-5 text-primary" />
            </div>
          </div>
        ) : (
          // Expanded state
          <div className="p-3">
            {/* Header with drag handle and controls */}
            <div className="flex items-center justify-between mb-2">
              <div
                ref={dragHandleRef}
                className={`movable-search-drag-handle flex items-center px-2 py-1 rounded-sm ${
                  isDragging ? 'bg-primary/10' : ''
                }`}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                title="Drag to move"
              >
                <Move className="h-4 w-4 text-muted-foreground mr-2" />
                <span className="text-xs text-muted-foreground font-medium">Quick Search</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={toggleMinimize}
                >
                  <Search className="h-3 w-3" />
                </Button>
                {onClose && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={onClose}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder={placeholder}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-4"
                onClick={focusInput}
              />
            </div>
            
            {/* Search results counter if there's a search term */}
            {searchTerm && (
              <div className="mt-2 text-xs text-muted-foreground">
                Searching for "{searchTerm}"...
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default MovableQuickSearch;