import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { scrollDashboardMainToTop } from '../lib/scrollDashboardMain';

const SHOW_AFTER_PX = 320;

export const ScrollToTopButton = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.dashboard-main');
    if (!main) return;

    const update = () => {
      setVisible(main.scrollTop > SHOW_AFTER_PX);
    };

    update();
    main.addEventListener('scroll', update, { passive: true });
    return () => {
      main.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <button
      type="button"
      className={`scroll-to-top-button${visible ? ' is-visible' : ''}`}
      aria-label={t('common.scrollToTop')}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={() => scrollDashboardMainToTop()}
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M6.7 14.7a1 1 0 0 1-1.4-1.4l6-6a1 1 0 0 1 1.4 0l6 6a1 1 0 1 1-1.4 1.4L12 9.4l-5.3 5.3Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
};
