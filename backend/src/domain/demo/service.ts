import { Client, type ClientDocument } from '../client/model';
import { Product, type ProductDocument } from '../product/model';
import { Sale, type SaleDocument } from '../sale/model';
import { formatClient, formatProduct, formatSale } from '../../shared/lib/formatters';
import { demoClients } from '../../shared/data/demo-clients';
import { demoProducts } from '../../shared/data/demo-products';
import { demoRepairOrders, demoSales } from '../../shared/data/demo-sales';
import { formatRecordNumber, resetRecordNumberSequence } from '../sequence/service';

type DemoSeedKind = 'all' | 'sales' | 'repairs';

const normalizeSeedKind = (value: unknown): DemoSeedKind => {
  if (value === 'sales' || value === 'repairs') {
    return value;
  }

  return 'all';
};

const getFixturesForKind = (kind: DemoSeedKind) => {
  if (kind === 'sales') {
    return demoSales.map((item) => ({ kind: 'sale' as const, item }));
  }

  if (kind === 'repairs') {
    return demoRepairOrders.map((item) => ({ kind: 'repair' as const, item }));
  }

  return [
    ...demoSales.map((item) => ({ kind: 'sale' as const, item })),
    ...demoRepairOrders.map((item) => ({ kind: 'repair' as const, item })),
  ];
};

const getSeedMessage = (
  kind: DemoSeedKind,
  productsCount: number,
  clientsCount: number,
  recordsCount: number,
) => {
  if (kind === 'sales') {
    return `Demo sales created: ${productsCount} products, ${clientsCount} clients, ${recordsCount} sales.`;
  }

  if (kind === 'repairs') {
    return `Demo repair orders created: ${productsCount} products, ${clientsCount} clients, ${recordsCount} orders.`;
  }

  return `Demo data created: ${productsCount} products, ${clientsCount} clients, ${demoSales.length} sales, ${demoRepairOrders.length} orders.`;
};

export const seedDemoData = async (seedKind?: unknown) => {
  const kind = normalizeSeedKind(seedKind);
  const fixtures = getFixturesForKind(kind);

  await Promise.all([Sale.deleteMany({}), Client.deleteMany({}), Product.deleteMany({})]);
  await resetRecordNumberSequence(0);

  const products = await Product.insertMany(
    demoProducts.map(({ key: _key, ...product }) => product),
    { ordered: true },
  );
  const clients = await Client.insertMany(
    demoClients.map(({ key: _key, ...client }) => client),
    { ordered: true },
  );

  const productMap = new Map(demoProducts.map((item, index) => [item.key, products[index]]));
  const clientMap = new Map(demoClients.map((item, index) => [item.key, clients[index]]));

  const sales = await Promise.all(
    fixtures.map(async ({ kind: recordKind, item: [saleDate, clientKey, productKey, quantity, salePrice, note] }, index) => {
      const client = clientMap.get(clientKey);
      const product = productMap.get(productKey);

      if (!client || !product) {
        throw new Error('Failed to build demo fixtures.');
      }

      if (recordKind === 'sale') {
        await Product.findByIdAndUpdate(product._id, { $inc: { quantity: -quantity } });
      }

      const sale = new Sale({
        recordNumber: formatRecordNumber(index + 1),
        saleDate: new Date(saleDate),
        client: client._id,
        product: product._id,
        quantity,
        salePrice,
        kind: recordKind,
        status: 'new',
        note,
        lineItems: [
          {
            id: `${product._id.toString()}-${recordKind}-demo-${index + 1}`,
            kind: recordKind === 'sale' ? 'product' : 'service',
            productId: recordKind === 'sale' ? product._id : null,
            name: recordKind === 'sale' ? product.name : 'Repair',
            price: salePrice,
            quantity,
          },
        ],
        productSnapshot: {
          article: product.article,
          name: product.name,
          serialNumber: product.serialNumber,
        },
        clientSnapshot: {
          name: client.name,
          phone: client.phone,
          status: client.status,
        },
      });

      await sale.save();
      return sale;
    }),
  );
  await resetRecordNumberSequence(sales.length);

  const freshProducts = await Product.find().sort({ createdAt: -1 }).lean<ProductDocument[]>();
  const freshClients = await Client.find().sort({ createdAt: -1 }).lean<ClientDocument[]>();
  const freshSales = await Sale.find().sort({ saleDate: -1 }).lean<SaleDocument[]>();

  return {
    message: getSeedMessage(kind, products.length, clients.length, sales.length),
    products: freshProducts.map(formatProduct),
    clients: freshClients.map(formatClient),
    sales: freshSales.map(formatSale),
  };
};
