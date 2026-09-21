import type React from 'react';
import { getPhoneNumberGroups } from '../orders/workspace/orders-workspace-shared';

export interface PhoneNumberProps {
  value: string;
}

export const PhoneNumber: React.FC<PhoneNumberProps> = ({
  value,
}) => {
  const groups = getPhoneNumberGroups(value);

  if (groups.length === 0) {
    return <>{value.replace(/^\+?38\s*/, '')}</>;
  }

  return (
    <span className='orders-client-phone'>
      {groups.map((group, index) => (
        <span key={`${group}-${index}`}>{group}</span>
      ))}
    </span>
  );
};
