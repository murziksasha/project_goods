import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TruncatedTextTooltipProps = {
  text: string;
  className?: string;
  children?: React.ReactNode;
  /** `select`: wrap a native <select> and measure the selected label vs inner width. */
  mode?: 'text' | 'select';
};

const SELECT_CHEVRON_RESERVE_PX = 22;
const OVERFLOW_SLACK_PX = 1;

const isNativeSelectLabelTruncated = (
  select: HTMLSelectElement,
  label: string,
): boolean => {
  const normalized = label.trim();
  if (!normalized) return false;

  const style = window.getComputedStyle(select);
  const probe = document.createElement('span');
  probe.dataset.overflowProbe = 'select';
  probe.textContent = normalized;
  probe.style.position = 'absolute';
  probe.style.left = '-9999px';
  probe.style.top = '0';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.whiteSpace = 'nowrap';
  probe.style.font =
    style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  probe.style.letterSpacing = style.letterSpacing;
  document.body.appendChild(probe);
  const textWidth = probe.offsetWidth;
  probe.remove();

  const padL = Number.parseFloat(style.paddingLeft) || 0;
  const padR = Number.parseFloat(style.paddingRight) || 0;
  const available =
    select.clientWidth - padL - padR - SELECT_CHEVRON_RESERVE_PX;
  return textWidth > available + OVERFLOW_SLACK_PX;
};

/**
 * TruncatedTextTooltip
 * - Only shows interactive tooltip when text is actually clipped (overflow)
 * - Tooltip stays visible while hovering the tooltip itself
 * - Full text inside tooltip is selectable and copyable
 * - `mode="select"` measures a descendant native select instead of ellipsizing the trigger
 */
export const TruncatedTextTooltip = ({
  text,
  className = '',
  children,
  mode = 'text',
}: TruncatedTextTooltipProps) => {
  const triggerRef = useRef<HTMLElement | null>(null);
  const [isOverflow, setIsOverflow] = useState(false);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const normalized = (text ?? '').trim();
  const hasChildren = children != null;
  const isSelectMode = mode === 'select';

  const computeOverflow = useCallback(() => {
    const el = triggerRef.current;
    if (!el) {
      setIsOverflow(false);
      return false;
    }

    if (isSelectMode) {
      const select = el.querySelector('select');
      const overflow = select
        ? isNativeSelectLabelTruncated(select, normalized)
        : false;
      setIsOverflow(overflow);
      return overflow;
    }

    const overflow = el.scrollWidth > el.clientWidth + OVERFLOW_SLACK_PX;
    setIsOverflow(overflow);
    return overflow;
  }, [isSelectMode, normalized]);

  useEffect(() => {
    const el = triggerRef.current;
    if (!el) {
      setIsOverflow(false);
      return;
    }

    computeOverflow();

    const ro = new ResizeObserver(computeOverflow);
    ro.observe(el);
    const select = isSelectMode ? el.querySelector('select') : null;
    if (select) {
      ro.observe(select);
    }

    window.addEventListener('resize', computeOverflow);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', computeOverflow);
    };
  }, [computeOverflow, hasChildren, isSelectMode]);

  const openTooltip = () => {
    const el = triggerRef.current;
    if (!el) return;
    if (!computeOverflow()) return;
    const rect = el.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY + 6,
      left: rect.left + window.scrollX,
    });
    setShow(true);
  };

  const closeTooltip = () => {
    setShow(false);
  };

  const tooltip =
    show && isOverflow
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
      : null;

  const classNames = `truncated-text-tooltip ${className}`.trim();
  const setTriggerNode = (node: HTMLElement | null) => {
    triggerRef.current = node;
  };

  if (isSelectMode) {
    return (
      <div
        ref={setTriggerNode}
        className={classNames}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
      >
        {children}
        {tooltip}
      </div>
    );
  }

  return (
    <span
      ref={setTriggerNode}
      className={classNames}
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
      title={isOverflow ? undefined : normalized}
    >
      {hasChildren ? children : normalized || '—'}
      {tooltip}
    </span>
  );
};
