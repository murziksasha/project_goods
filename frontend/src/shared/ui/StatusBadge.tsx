import type { HTMLAttributes } from 'react';

export type ClientStatusTone = 'new' | 'vip' | 'opt' | 'blacklist' | 'ok';

export type StatusBadgeTone =
  | ClientStatusTone
  | 'gray'
  | 'new'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

const toneClassName: Record<StatusBadgeTone, string> = {
  new: 'status-new',
  vip: 'status-vip',
  opt: 'status-opt',
  blacklist: 'status-blacklist',
  ok: 'status-ok',
  gray: 'status-gray',
  success: 'status-opt',
  warning: 'status-vip',
  danger: 'status-blacklist',
  info: 'status-ok',
};

export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  label: string;
  tone?: StatusBadgeTone;
  clientStatus?: ClientStatusTone | '';
};

const resolveClientStatusTone = (
  clientStatus: ClientStatusTone | '',
): StatusBadgeTone => (clientStatus ? clientStatus : 'gray');

export const StatusBadge = ({
  label,
  tone,
  clientStatus,
  className = '',
  ...props
}: StatusBadgeProps) => {
  const resolvedTone =
    tone ??
    (clientStatus !== undefined
      ? resolveClientStatusTone(clientStatus)
      : 'gray');

  return (
    <span
      className={`client-status-badge ${toneClassName[resolvedTone]} ${className}`.trim()}
      {...props}
    >
      {label}
    </span>
  );
};