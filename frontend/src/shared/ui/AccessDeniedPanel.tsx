import { useTranslation } from 'react-i18next';
import type { PageKey } from '../../pages/dashboard/model/types';
import { getDashboardHref } from '../../pages/dashboard/model/types';
import { Button } from './Button';

const pageLabelKeys: Record<PageKey, string> = {
  home: 'nav.home',
  orders: 'nav.orders',
  accounting: 'nav.accounting',
  warehouse: 'nav.warehouse',
  catalog: 'nav.catalog',
  clients: 'nav.clients',
  employees: 'nav.employees',
  settings: 'nav.settings',
};

type AccessDeniedPanelProps = {
  page: PageKey;
  allowedPages: PageKey[];
  onNavigate: (page: PageKey) => void;
};

export const AccessDeniedPanel = ({
  page,
  allowedPages,
  onNavigate,
}: AccessDeniedPanelProps) => {
  const { t } = useTranslation();
  const pageName = t(pageLabelKeys[page]);
  const links = allowedPages.filter((item) => item !== page);

  return (
    <section className="panel access-denied-panel" role="alert">
      <div className="panel-header">
        <div>
          <p className="section-label">{t('accessDenied.label')}</p>
          <h2>{t('accessDenied.title')}</h2>
        </div>
      </div>
      <p className="access-denied-message">
        {t('accessDenied.message', { page: pageName })}
      </p>
      <p className="muted-copy">{t('accessDenied.hint')}</p>
      <div className="access-denied-actions">
        <Button variant="primary" onClick={() => onNavigate('home')}>
          {t('accessDenied.goHome')}
        </Button>
        {links.slice(0, 4).map((item) => (
          <a
            key={item}
            className="secondary-button access-denied-link"
            href={getDashboardHref(item)}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(item);
            }}
          >
            {t(pageLabelKeys[item])}
          </a>
        ))}
      </div>
    </section>
  );
};
