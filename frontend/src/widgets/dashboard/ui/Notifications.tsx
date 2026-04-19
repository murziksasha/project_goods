type NotificationsProps = {
  error: string;
  successMessage: string;
};

export const Notifications = ({
  error,
  successMessage,
}: NotificationsProps) => (
  <>
    {error ? <p className="banner banner-error">{error}</p> : null}
    {successMessage ? <p className="banner banner-success">{successMessage}</p> : null}
  </>
);
