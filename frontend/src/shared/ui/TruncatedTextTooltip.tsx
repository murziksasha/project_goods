import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TruncatedTextTooltipProps = {
  text: string;
  className?: string;
  children?: React.ReactNode;
};

/**
 * TruncatedTextTooltip
 * - Only shows interactive tooltip when text is actually clipped (overflow)
 * - Tooltip stays visible while hovering the tooltip itself
 * - Full text inside tooltip is selectable and copyable
 */
export const TruncatedTextTooltip = ({
  text,
  className = '',
  children,
}: TruncatedTextTooltipProps) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const normalized = (text ?? '').trim();
  const hasChildren = children != null;

  useEffect(() => {
    const el = triggerRef.current;
    if (!el) {
      setIsOverflow(false);
      return;
    }

    const computeOverflow = () => {
      const overflow = el.scrollWidth > el.clientWidth + 1;
      setIsOverflow(overflow);
    };

    computeOverflow();

    const ro = new ResizeObserver(computeOverflow);
    ro.observe(el);

    window.addEventListener('resize', computeOverflow);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', computeOverflow);
    };
  }, [normalized, hasChildren]);

  const openTooltip = () => {
    if (!isOverflow) return;
    const el = triggerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
      });
    }
    setShow(true);
  };

  const closeTooltip = () => {
    setShow(false);
  };

  return (
    <span
      ref={triggerRef}
      className={`truncated-text-tooltip ${className}`.trim()}
      onMouseEnter={openTooltip}
      onMouseLeave={closeTooltip}
      style={{
        display: 'inline-block',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        verticalAlign: 'bottom',
      }}
      // native title as fallback for non-hover / a11y
      title={isOverflow ? undefined : normalized}
    >
      {hasChildren ? children : normalized || '—'}
      {show && isOverflow
        ? createPortal(
            <div
              onMouseEnter={() => setShow(true)}
              onMouseLeave={closeTooltip}
              style={{
                position: 'absolute',
                top: pos.top,
                left: pos.left,
                zIndex: 2147483647,
                maxWidth: 'min(520px, 85vw)',
                background: '#1f2937',
                color: '#f3f4f6',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: '12.5px',
                lineHeight: 1.3,
                boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                userSelect: 'text',
                cursor: 'text',
                pointerEvents: 'auto',
              }}
            >
              {normalized}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
};
