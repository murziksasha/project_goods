import { useTranslation } from 'react-i18next';

export const OrderDetailCardSkeleton = () => {
  const { t } = useTranslation();

  return (
    <article
      className='order-detail-card order-detail-card-skeleton'
      aria-busy='true'
      aria-label={t('orders.detail.loadingCard')}
    >
      <header className='order-detail-header'>
        <div className='order-detail-title'>
          <span className='skeleton-line skeleton-line-short' />
          <span className='skeleton-line skeleton-line-title' />
        </div>
        <span className='skeleton-block skeleton-block-close' />
        <div className='order-detail-actions'>
          <span className='skeleton-block skeleton-block-status' />
          <span className='skeleton-block skeleton-block-action' />
        </div>
      </header>
      <div className='order-detail-grid'>
        <section className='order-detail-panel'>
          <span className='skeleton-line skeleton-line-section' />
          <div className='order-detail-skeleton-rows'>
            {Array.from({ length: 4 }, (_, index) => (
              <span
                key={`main-info-${index}`}
                className='skeleton-line skeleton-line-row'
              />
            ))}
          </div>
        </section>
        <section className='order-detail-panel'>
          <span className='skeleton-line skeleton-line-section' />
          <div className='order-detail-skeleton-rows'>
            {Array.from({ length: 3 }, (_, index) => (
              <span
                key={`live-feed-${index}`}
                className='skeleton-line skeleton-line-row'
              />
            ))}
          </div>
        </section>
      </div>
    </article>
  );
};