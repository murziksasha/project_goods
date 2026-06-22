export const getClientPhonesFromRecord = (client: {
  phone?: string;
  phones?: string[];
}) => {
  if (Array.isArray(client.phones) && client.phones.length > 0) {
    return client.phones.filter((phone): phone is string => Boolean(phone));
  }

  return client.phone ? [client.phone] : [];
};