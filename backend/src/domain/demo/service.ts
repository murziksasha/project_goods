import { Client, type ClientDocument } from '../client/model';
import { Product, type ProductDocument } from '../product/model';
import { Sale, type SaleDocument } from '../sale/model';
import { formatClient, formatProduct, formatSale } from '../../shared/lib/formatters';
import { demoClients } from '../../shared/data/demo-clients';
import { demoProducts } from '../../shared/data/demo-products';
import { demoSales } from '../../shared/data/demo-sales';

export const seedDemoData = async () => {
  await Promise.all([Sale.deleteMany({}), Client.deleteMany({}), Product.deleteMany({})]);

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
    demoSales.map(async ([saleDate, clientKey, productKey, quantity, salePrice, note]) => {
      const client = clientMap.get(clientKey);
      const product = productMap.get(productKey);

      if (!client || !product) {
        throw new Error('Failed to build demo fixtures.');
      }

      await Product.findByIdAndUpdate(product._id, { $inc: { quantity: -quantity } });

      const sale = new Sale({
        saleDate: new Date(saleDate),
        client: client._id,
        product: product._id,
        quantity,
        salePrice,
        note,
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

  const freshProducts = await Product.find().sort({ createdAt: -1 }).lean<ProductDocument[]>();
  const freshClients = await Client.find().sort({ createdAt: -1 }).lean<ClientDocument[]>();
  const freshSales = await Sale.find().sort({ saleDate: -1 }).lean<SaleDocument[]>();

  return {
    message: `Demo data created: ${products.length} products, ${clients.length} clients, ${sales.length} sales.`,
    products: freshProducts.map(formatProduct),
    clients: freshClients.map(formatClient),
    sales: freshSales.map(formatSale),
  };
};
