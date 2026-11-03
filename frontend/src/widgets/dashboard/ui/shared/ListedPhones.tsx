import type React from 'react';
import { CopyableValue } from '../../../../shared/ui/CopyableValue';
import { PhoneNumber } from './PhoneNumber';

export interface ListedPhonesProps {
  primary: string;
  matchedAdditional?: string;
  link?: boolean;
}

const PhoneControl: React.FC<{ value: string; link: boolean }> = ({
  value,
  link,
}) => (
  <CopyableValue value={value}>
    {link ? (
      <a
        href={`tel:${value}`}
        title={value}
        onClick={(event) => event.stopPropagation()}
      >
        <PhoneNumber value={value} />
      </a>
    ) : (
      <span title={value}>
        <PhoneNumber value={value} />
      </span>
    )}
  </CopyableValue>
);

export const ListedPhones: React.FC<ListedPhonesProps> = ({
  primary,
  matchedAdditional = '',
  link = false,
}) => {
  if (!primary && !matchedAdditional) return null;

  return (
    <span className='listed-phones'>
      {primary ? <PhoneControl value={primary} link={link} /> : null}
      {matchedAdditional ? (
        <PhoneControl value={matchedAdditional} link={link} />
      ) : null}
    </span>
  );
};
