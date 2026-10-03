import type React from 'react';

export interface ReorderableSuggestionItemProps {
  id: string;
  isActive?: boolean;
  disabled?: boolean;
  canReorder?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onSelect: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDragStart?: (event: React.DragEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  title?: string;
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
}

export const ReorderableSuggestionItem: React.FC<ReorderableSuggestionItemProps> = ({
  id,
  isActive = false,
  disabled = false,
  canReorder = false,
  isFirst = false,
  isLast = false,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging = false,
  isDragOver = false,
  title,
  ariaLabel,
  children,
  className = '',
}) => {
  const itemClasses = [
    'create-suggestion-item',
    'reorderable-suggestion-item',
    isActive ? 'is-active' : '',
    isDragging ? 'is-dragging' : '',
    isDragOver ? 'is-drag-over' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={itemClasses}
      data-id={id}
      onDragOver={onDragOver}
      onDrop={onDrop}
      title={title}
    >
      {canReorder ? (
        <div className="suggestion-reorder-controls">
          <button
            type="button"
            className="suggestion-drag-handle"
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            aria-label="Drag to reorder"
            tabIndex={-1}
          >
            &#x22EE;&#x22EE;
          </button>
          <div className="suggestion-shift-buttons">
            <button
              type="button"
              className="suggestion-shift-btn"
              disabled={isFirst}
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp?.();
              }}
              aria-label="Move up"
              tabIndex={-1}
            >
              &uarr;
            </button>
            <button
              type="button"
              className="suggestion-shift-btn"
              disabled={isLast}
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown?.();
              }}
              aria-label="Move down"
              tabIndex={-1}
            >
              &darr;
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="suggestion-content-button"
        disabled={disabled}
        onClick={onSelect}
        aria-label={ariaLabel}
        onMouseDown={(e) => {
          // Prevent losing focus on the input when clicking suggestion
          e.preventDefault();
        }}
      >
        {children}
      </button>
    </div>
  );
};

