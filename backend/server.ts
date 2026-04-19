import cors from 'cors';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import XLSX from 'xlsx';

dotenv.config();

const PORT = Number(process.env.PORT ?? 5000);
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/inventory';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;

const app = express();

app.use(
  cors({
    origin: CLIENT_ORIGIN ? CLIENT_ORIGIN.split(',').map((origin) => origin.trim()) : true,
  }),
);
app.use(express.json());

const clientStatuses = ['new', 'vip', 'opt', 'blacklist', 'ok'] as const;

type ClientStatus = (typeof clientStatuses)[number];

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must contain at least 2 characters'],
      maxlength: [120, 'Product name must contain no more than 120 characters'],
    },
    article: {
      type: String,
      required: [true, 'Article is required'],
      trim: true,
      uppercase: true,
      maxlength: [50, 'Article must contain no more than 50 characters'],
      unique: true,
    },
    serialNumber: {
      type: String,
      required: [true, 'Serial number is required'],
      trim: true,
      uppercase: true,
      maxlength: [80, 'Serial number must contain no more than 80 characters'],
      unique: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    salePriceOptions: {
      type: [Number],
      default: [],
      validate: {
        validator: (values: number[]) =>
          Array.isArray(values) &&
          values.every((value) => Number.isFinite(value) && value >= 0),
        message: 'Sale price options must contain only valid non-negative numbers.',
      },
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Product note must contain no more than 500 characters'],
      default: '',
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
    },
    reservedQuantity: {
      type: Number,
      min: [0, 'Reserved quantity cannot be negative'],
      default: 0,
    },
    purchasePlace: {
      type: String,
      trim: true,
      maxlength: [120, 'Purchase place must contain no more than 120 characters'],
      default: '',
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    warrantyPeriod: {
      type: Number,
      min: [0, 'Warranty period cannot be negative'],
      default: 0,
    },
    searchText: {
      type: String,
      default: '',
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

productSchema.pre('validate', function updateSearchText() {
  this.searchText = [
    this.name,
    this.article,
    this.serialNumber,
    this.note,
    this.purchasePlace,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
});

const clientSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Client phone is required'],
      trim: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
      minlength: [2, 'Client name must contain at least 2 characters'],
      maxlength: [120, 'Client name must contain no more than 120 characters'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Client note must contain no more than 500 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: clientStatuses,
      default: 'new',
    },
    searchText: {
      type: String,
      default: '',
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

clientSchema.pre('validate', function updateSearchText() {
  this.searchText = [this.phone, this.name, this.note]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
});

const saleSchema = new mongoose.Schema(
  {
    saleDate: {
      type: Date,
      default: Date.now,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client is required'],
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Sale quantity is required'],
      min: [1, 'Sale quantity must be at least 1'],
    },
    salePrice: {
      type: Number,
      required: [true, 'Sale price is required'],
      min: [0, 'Sale price cannot be negative'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Sale note must contain no more than 500 characters'],
      default: '',
    },
    productSnapshot: {
      article: { type: String, required: true },
      name: { type: String, required: true },
      serialNumber: { type: String, required: true },
    },
    clientSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      status: { type: String, required: true },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

type ProductDocument = mongoose.InferSchemaType<typeof productSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

type ClientDocument = mongoose.InferSchemaType<typeof clientSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

type SaleDocument = mongoose.InferSchemaType<typeof saleSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

type ProductPayload = {
  name?: unknown;
  article?: unknown;
  serialNumber?: unknown;
  price?: unknown;
  salePriceOptions?: unknown;
  quantity?: unknown;
  note?: unknown;
  purchasePlace?: unknown;
  purchaseDate?: unknown;
  warrantyPeriod?: unknown;
  reservedQuantity?: unknown;
};

type ClientPayload = {
  phone?: unknown;
  name?: unknown;
  note?: unknown;
  status?: unknown;
};

type SalePayload = {
  saleDate?: unknown;
  clientId?: unknown;
  productId?: unknown;
  quantity?: unknown;
  salePrice?: unknown;
  note?: unknown;
};

const Product = mongoose.model('Product', productSchema);
const Client = mongoose.model('Client', clientSchema);
const Sale = mongoose.model('Sale', saleSchema);

const toNonEmptyString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const toOptionalDate = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value);
  }

  return NaN;
};

const normalizePhone = (value: unknown) =>
  String(value ?? '')
    .replace(/[^\d+]/g, '')
    .trim();

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeProductPayload = (payload: ProductPayload) => ({
  name: toNonEmptyString(payload.name),
  article: toNonEmptyString(payload.article).toUpperCase(),
  serialNumber: toNonEmptyString(payload.serialNumber).toUpperCase(),
  price: toNumber(payload.price),
  salePriceOptions: Array.isArray(payload.salePriceOptions)
    ? payload.salePriceOptions
        .map((value) => toNumber(value))
        .filter((value) => Number.isFinite(value) && value >= 0)
    : String(payload.salePriceOptions ?? '')
        .split(',')
        .map((value) => toNumber(value.trim()))
        .filter((value) => Number.isFinite(value) && value >= 0),
  quantity: toNumber(payload.quantity),
  note: toNonEmptyString(payload.note),
  reservedQuantity:
    payload.reservedQuantity === '' || payload.reservedQuantity === undefined
      ? 0
      : toNumber(payload.reservedQuantity),
  purchasePlace: toNonEmptyString(payload.purchasePlace),
  purchaseDate: toOptionalDate(payload.purchaseDate),
  warrantyPeriod:
    payload.warrantyPeriod === '' || payload.warrantyPeriod === undefined
      ? 0
      : toNumber(payload.warrantyPeriod),
});

const normalizeClientPayload = (payload: ClientPayload) => ({
  phone: normalizePhone(payload.phone),
  name: toNonEmptyString(payload.name),
  note: toNonEmptyString(payload.note),
  status: clientStatuses.includes(String(payload.status ?? '') as ClientStatus)
    ? (payload.status as ClientStatus)
    : 'new',
});

const normalizeSalePayload = (payload: SalePayload) => ({
  saleDate: toOptionalDate(payload.saleDate) ?? new Date(),
  clientId: toNonEmptyString(payload.clientId),
  productId: toNonEmptyString(payload.productId),
  quantity: toNumber(payload.quantity),
  salePrice: toNumber(payload.salePrice),
  note: toNonEmptyString(payload.note),
});

const formatProduct = (product: ProductDocument) => {
  const freeQuantity = Math.max(product.quantity - product.reservedQuantity, 0);

  return {
    id: product._id.toString(),
    name: product.name,
    article: product.article,
    serialNumber: product.serialNumber ?? '',
    price: product.price,
    salePriceOptions: product.salePriceOptions ?? [],
    note: product.note ?? '',
    quantity: product.quantity,
    reservedQuantity: product.reservedQuantity,
    freeQuantity,
    isInStock: freeQuantity > 0,
    purchasePlace: product.purchasePlace,
    purchaseDate: product.purchaseDate ? product.purchaseDate.toISOString() : null,
    warrantyPeriod: product.warrantyPeriod,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
};

const formatClient = (client: ClientDocument) => ({
  id: client._id.toString(),
  phone: client.phone,
  name: client.name,
  note: client.note,
  status: client.status,
  createdAt: client.createdAt.toISOString(),
  updatedAt: client.updatedAt.toISOString(),
});

const formatSale = (sale: SaleDocument) => ({
  id: sale._id.toString(),
  saleDate: sale.saleDate.toISOString(),
  quantity: sale.quantity,
  salePrice: sale.salePrice,
  note: sale.note,
  client: {
    id: sale.client.toString(),
    ...sale.clientSnapshot,
  },
  product: {
    id: sale.product.toString(),
    ...sale.productSnapshot,
    serialNumber: sale.productSnapshot?.serialNumber ?? '',
  },
  createdAt: sale.createdAt.toISOString(),
  updatedAt: sale.updatedAt.toISOString(),
});

const formatClientHistory = (client: ClientDocument, sales: SaleDocument[]) => ({
  client: formatClient(client),
  sales: sales.map(formatSale),
  stats: {
    totalSales: sales.length,
    totalRevenue: sales.reduce(
      (sum, sale) => sum + sale.salePrice * sale.quantity,
      0,
    ),
    totalItemsSold: sales.reduce((sum, sale) => sum + sale.quantity, 0),
  },
});

const createDemoProducts = () => [
  {
    name: 'Wireless Mouse Logitech M185',
    article: 'MOU-001',
    serialNumber: 'LOG-M185-0001',
    price: 649,
    salePriceOptions: [649, 699],
    note: 'Compact office mouse with USB receiver.',
    quantity: 28,
    reservedQuantity: 2,
    purchasePlace: 'Rozetka',
    purchaseDate: new Date('2026-03-02'),
    warrantyPeriod: 12,
  },
  {
    name: 'Mechanical Keyboard Ajazz AK820',
    article: 'KEY-002',
    serialNumber: 'AJZ-AK820-0002',
    price: 2499,
    salePriceOptions: [2499, 2599, 2799],
    note: 'Mechanical keyboard with hot-swap switches.',
    quantity: 17,
    reservedQuantity: 1,
    purchasePlace: 'Brain',
    purchaseDate: new Date('2026-02-11'),
    warrantyPeriod: 24,
  },
  {
    name: 'USB-C Hub Baseus 6-in-1',
    article: 'HUB-003',
    serialNumber: 'BAS-HUB6-0003',
    price: 1299,
    salePriceOptions: [1299, 1399],
    note: '6-in-1 hub with HDMI and Power Delivery.',
    quantity: 22,
    reservedQuantity: 0,
    purchasePlace: 'Allo',
    purchaseDate: new Date('2026-01-17'),
    warrantyPeriod: 12,
  },
  {
    name: 'Portable SSD Samsung T7 1TB',
    article: 'SSD-004',
    serialNumber: 'SAM-T7-1TB-0004',
    price: 3899,
    salePriceOptions: [3899, 3999, 4199],
    note: 'Fast external SSD, often bundled with laptops.',
    quantity: 16,
    reservedQuantity: 1,
    purchasePlace: 'Comfy',
    purchaseDate: new Date('2026-01-25'),
    warrantyPeriod: 36,
  },
  {
    name: '27-inch Monitor LG UltraGear',
    article: 'MON-005',
    serialNumber: 'LG-27UG-0005',
    price: 8999,
    salePriceOptions: [8999, 9299],
    note: 'Popular gaming monitor with IPS panel.',
    quantity: 13,
    reservedQuantity: 2,
    purchasePlace: 'Foxtrot',
    purchaseDate: new Date('2026-02-04'),
    warrantyPeriod: 24,
  },
  {
    name: 'Webcam Logitech C920',
    article: 'CAM-006',
    serialNumber: 'LOG-C920-0006',
    price: 2799,
    salePriceOptions: [2799, 2899, 2999],
    note: 'Full HD webcam for meetings and streaming.',
    quantity: 19,
    reservedQuantity: 0,
    purchasePlace: 'Rozetka',
    purchaseDate: new Date('2026-03-09'),
    warrantyPeriod: 24,
  },
  {
    name: 'Bluetooth Speaker JBL Flip 6',
    article: 'SPK-007',
    serialNumber: 'JBL-FLIP6-0007',
    price: 4299,
    salePriceOptions: [4299, 4499],
    note: 'Portable speaker with strong demand before holidays.',
    quantity: 21,
    reservedQuantity: 1,
    purchasePlace: 'Allo',
    purchaseDate: new Date('2026-04-12'),
    warrantyPeriod: 12,
  },
  {
    name: 'Wi-Fi Router TP-Link Archer AX55',
    article: 'RTR-008',
    serialNumber: 'TPL-AX55-0008',
    price: 3199,
    salePriceOptions: [3199, 3299, 3499],
    note: 'Wi-Fi 6 router for home and office setups.',
    quantity: 18,
    reservedQuantity: 1,
    purchasePlace: 'Brain',
    purchaseDate: new Date('2026-05-07'),
    warrantyPeriod: 24,
  },
  {
    name: 'Gaming Headset HyperX Cloud Stinger 2',
    article: 'HDP-009',
    serialNumber: 'HPX-ST2-0009',
    price: 2299,
    salePriceOptions: [2299, 2399],
    note: 'Entry gaming headset with good microphone clarity.',
    quantity: 24,
    reservedQuantity: 2,
    purchasePlace: 'Rozetka',
    purchaseDate: new Date('2026-06-18'),
    warrantyPeriod: 12,
  },
  {
    name: 'Power Bank Xiaomi 20000mAh',
    article: 'PWB-010',
    serialNumber: 'XMI-PB20-0010',
    price: 1599,
    salePriceOptions: [1599, 1699],
    note: 'Frequently purchased in pairs for travel.',
    quantity: 35,
    reservedQuantity: 3,
    purchasePlace: 'Comfy',
    purchaseDate: new Date('2026-07-02'),
    warrantyPeriod: 12,
  },
  {
    name: 'Laptop Stand Ugreen Foldable',
    article: 'STD-011',
    serialNumber: 'UGR-STD-0011',
    price: 999,
    salePriceOptions: [999, 1099],
    note: 'Accessory item with steady office demand.',
    quantity: 27,
    reservedQuantity: 0,
    purchasePlace: 'Epicentr',
    purchaseDate: new Date('2026-08-21'),
    warrantyPeriod: 6,
  },
  {
    name: 'Wireless Charger Anker PowerWave',
    article: 'CHG-012',
    serialNumber: 'ANK-PW-0012',
    price: 1199,
    salePriceOptions: [1199, 1299],
    note: 'Good add-on item near the checkout.',
    quantity: 20,
    reservedQuantity: 0,
    purchasePlace: 'Allo',
    purchaseDate: new Date('2026-09-14'),
    warrantyPeriod: 12,
  },
];

const createDemoClients = () => [
  {
    phone: '+380671112233',
    name: 'Ivan Petrenko',
    note: 'Regular buyer, often picks peripherals.',
    status: 'ok' as ClientStatus,
  },
  {
    phone: '+380931234567',
    name: 'Olena Kovalenko',
    note: 'Wholesale orders for office equipment.',
    status: 'opt' as ClientStatus,
  },
  {
    phone: '+380501010101',
    name: 'Maxim Bondar',
    note: 'VIP customer, fast response requested.',
    status: 'vip' as ClientStatus,
  },
  {
    phone: '+380661234890',
    name: 'Svitlana Marchenko',
    note: 'Buys accessories for the design team.',
    status: 'ok' as ClientStatus,
  },
  {
    phone: '+380971234321',
    name: 'Taras Melnyk',
    note: 'Often compares several monitors before purchase.',
    status: 'new' as ClientStatus,
  },
  {
    phone: '+380631117700',
    name: 'Andriy Shevchuk',
    note: 'Wholesale client for coworking space upgrades.',
    status: 'opt' as ClientStatus,
  },
];

const isValidObjectIdOrThrow = (value: string, label: string) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`Valid ${label} is required.`);
  }
};

const ensureFreeStock = async (
  productId: mongoose.Types.ObjectId | string,
  quantity: number,
) => {
  const product = await Product.findById(productId).lean<ProductDocument | null>();

  if (!product) {
    throw new Error('Product not found.');
  }

  if (Math.max(product.quantity - product.reservedQuantity, 0) < quantity) {
    throw new Error('Not enough free stock for this operation.');
  }

  return product;
};

const applyProductQuantityDelta = async (
  productId: mongoose.Types.ObjectId | string,
  delta: number,
) => {
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    {
      $inc: {
        quantity: delta,
      },
    },
    {
      new: true,
    },
  ).lean<ProductDocument | null>();

  if (!updatedProduct) {
    throw new Error('Product not found.');
  }

  return updatedProduct;
};

const getSearchQuery = (rawQuery: unknown) => {
  const query = typeof rawQuery === 'string' ? rawQuery.trim().toLowerCase() : '';

  if (!query) {
    return {};
  }

  return {
    searchText: {
      $regex: escapeRegExp(query),
      $options: 'i',
    },
  };
};

const isDuplicateKeyError = (error: unknown): error is { code: number; keyPattern?: Record<string, number> } =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 11000;

const getErrorMessage = (error: unknown) => {
  if (error instanceof mongoose.Error.ValidationError) {
    return Object.values(error.errors)
      .map((validationError) => validationError.message)
      .join(', ');
  }

  if (isDuplicateKeyError(error)) {
    if (error.keyPattern?.article) {
      return 'Product article must be unique.';
    }

    if (error.keyPattern?.serialNumber) {
      return 'Product serial number must be unique.';
    }

    if (error.keyPattern?.phone) {
      return 'Client phone must be unique.';
    }

    return 'Duplicate value detected.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected server error';
};

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mongoReadyState: mongoose.connection.readyState,
  });
});

app.get('/api/products', async (req, res, next) => {
  try {
    const query = getSearchQuery(req.query.query);
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .lean<ProductDocument[]>();

    res.json(products.map(formatProduct));
  } catch (error) {
    next(error);
  }
});

app.post('/api/products', async (req, res, next) => {
  try {
    const product = new Product(normalizeProductPayload(req.body as ProductPayload));
    await product.validate();
    await product.save();
    res.status(201).json(formatProduct(product.toObject<ProductDocument>()));
  } catch (error) {
    next(error);
  }
});

app.put('/api/products/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    isValidObjectIdOrThrow(productId, 'productId');

    const existingProduct = await Product.findById(productId).lean<ProductDocument | null>();

    if (!existingProduct) {
      throw new Error('Product not found.');
    }

    const normalizedPayload = normalizeProductPayload(req.body as ProductPayload);
    const nextFreeQuantity =
      normalizedPayload.quantity - existingProduct.reservedQuantity;

    if (nextFreeQuantity < 0) {
      throw new Error('Quantity cannot be less than reserved quantity.');
    }

    const product = await Product.findByIdAndUpdate(
      productId,
      normalizedPayload,
      {
        new: true,
        runValidators: true,
      },
    ).lean<ProductDocument | null>();

    if (!product) {
      throw new Error('Product not found.');
    }

    res.json(formatProduct(product));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/products/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    isValidObjectIdOrThrow(productId, 'productId');

    const hasSales = await Sale.exists({ product: productId });

    if (hasSales) {
      throw new Error('Cannot delete a product that has sales history.');
    }

    const deletedProduct = await Product.findByIdAndDelete(productId).lean<ProductDocument | null>();

    if (!deletedProduct) {
      throw new Error('Product not found.');
    }

    res.json({ id: productId });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/export', async (_req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean<ProductDocument[]>();
    const exportRows = products.map((product) => {
      const freeQuantity = Math.max(product.quantity - product.reservedQuantity, 0);

      return {
        Name: product.name,
        Article: product.article,
        'Serial Number': product.serialNumber,
        Price: product.price,
        'Sale Price Options': (product.salePriceOptions ?? []).join(', '),
        Note: product.note ?? '',
        Quantity: product.quantity,
        'Reserved Quantity': product.reservedQuantity,
        'Free Quantity': freeQuantity,
        'In Stock': freeQuantity > 0 ? 'Yes' : 'No',
        'Purchase Place': product.purchasePlace,
        'Purchase Date': product.purchaseDate
          ? product.purchaseDate.toISOString().slice(0, 10)
          : '',
        'Warranty Period (months)': product.warrantyPeriod,
        'Created At': product.createdAt.toISOString(),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="products.xlsx"',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

app.post('/api/products/import', (_req, res) => {
  res.status(501).json({
    message: 'Excel import is not implemented yet.',
  });
});

app.get('/api/clients', async (req, res, next) => {
  try {
    const query = getSearchQuery(req.query.query) as Record<string, unknown>;
    const status =
      typeof req.query.status === 'string' && req.query.status !== 'all'
        ? req.query.status
        : '';

    if (status && clientStatuses.includes(status as ClientStatus)) {
      query.status = status;
    }

    const clients = await Client.find(query)
      .sort({ createdAt: -1 })
      .lean<ClientDocument[]>();

    res.json(clients.map(formatClient));
  } catch (error) {
    next(error);
  }
});

app.post('/api/clients', async (req, res, next) => {
  try {
    const client = new Client(normalizeClientPayload(req.body as ClientPayload));
    await client.validate();
    await client.save();
    res.status(201).json(formatClient(client.toObject<ClientDocument>()));
  } catch (error) {
    next(error);
  }
});

app.put('/api/clients/:clientId', async (req, res, next) => {
  try {
    const { clientId } = req.params;
    isValidObjectIdOrThrow(clientId, 'clientId');

    const client = await Client.findByIdAndUpdate(
      clientId,
      normalizeClientPayload(req.body as ClientPayload),
      {
        new: true,
        runValidators: true,
      },
    ).lean<ClientDocument | null>();

    if (!client) {
      throw new Error('Client not found.');
    }

    res.json(formatClient(client));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/clients/:clientId', async (req, res, next) => {
  try {
    const { clientId } = req.params;
    isValidObjectIdOrThrow(clientId, 'clientId');

    const hasSales = await Sale.exists({ client: clientId });

    if (hasSales) {
      throw new Error('Cannot delete a client that has sales history.');
    }

    const deletedClient = await Client.findByIdAndDelete(clientId).lean<ClientDocument | null>();

    if (!deletedClient) {
      throw new Error('Client not found.');
    }

    res.json({ id: clientId });
  } catch (error) {
    next(error);
  }
});

app.get('/api/clients/:clientId/history', async (req, res, next) => {
  try {
    const { clientId } = req.params;
    isValidObjectIdOrThrow(clientId, 'clientId');

    const client = await Client.findById(clientId).lean<ClientDocument | null>();

    if (!client) {
      throw new Error('Client not found.');
    }

    const sales = await Sale.find({ client: clientId })
      .sort({ saleDate: -1 })
      .lean<SaleDocument[]>();

    res.json(formatClientHistory(client, sales));
  } catch (error) {
    next(error);
  }
});

app.get('/api/sales', async (_req, res, next) => {
  try {
    const sales = await Sale.find().sort({ saleDate: -1 }).lean<SaleDocument[]>();
    res.json(sales.map(formatSale));
  } catch (error) {
    next(error);
  }
});

app.post('/api/sales', async (req, res, next) => {
  try {
    const payload = normalizeSalePayload(req.body as SalePayload);

    isValidObjectIdOrThrow(payload.clientId, 'clientId');
    isValidObjectIdOrThrow(payload.productId, 'productId');

    const [client, product] = await Promise.all([
      Client.findById(payload.clientId).lean<ClientDocument | null>(),
      ensureFreeStock(payload.productId, payload.quantity),
    ]);

    if (!client) {
      throw new Error('Client not found.');
    }

    if (client.status === 'blacklist') {
      throw new Error('Sales are blocked for blacklist clients.');
    }

    if (!product) {
      throw new Error('Product not found.');
    }

    if (!Number.isFinite(payload.quantity) || payload.quantity < 1) {
      throw new Error('Sale quantity must be at least 1.');
    }

    if (!Number.isFinite(payload.salePrice) || payload.salePrice < 0) {
      throw new Error('Sale price cannot be negative.');
    }

    const updatedProduct = await applyProductQuantityDelta(
      payload.productId,
      -payload.quantity,
    );

    try {
      const sale = new Sale({
        saleDate: payload.saleDate,
        client: client._id,
        product: product._id,
        quantity: payload.quantity,
        salePrice: payload.salePrice,
        note: payload.note,
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

      await sale.validate();
      await sale.save();

      res.status(201).json({
        sale: formatSale(sale.toObject<SaleDocument>()),
        product: formatProduct(updatedProduct),
      });
    } catch (error) {
      await Product.findByIdAndUpdate(payload.productId, {
        $inc: {
          quantity: payload.quantity,
        },
      });

      throw error;
    }
  } catch (error) {
    next(error);
  }
});

app.put('/api/sales/:saleId', async (req, res, next) => {
  try {
    const { saleId } = req.params;
    isValidObjectIdOrThrow(saleId, 'saleId');

    const payload = normalizeSalePayload(req.body as SalePayload);
    isValidObjectIdOrThrow(payload.clientId, 'clientId');
    isValidObjectIdOrThrow(payload.productId, 'productId');

    const existingSale = await Sale.findById(saleId).lean<SaleDocument | null>();

    if (!existingSale) {
      throw new Error('Sale not found.');
    }

    if (!Number.isFinite(payload.quantity) || payload.quantity < 1) {
      throw new Error('Sale quantity must be at least 1.');
    }

    if (!Number.isFinite(payload.salePrice) || payload.salePrice < 0) {
      throw new Error('Sale price cannot be negative.');
    }

    const [client, product] = await Promise.all([
      Client.findById(payload.clientId).lean<ClientDocument | null>(),
      Product.findById(payload.productId).lean<ProductDocument | null>(),
    ]);

    if (!client) {
      throw new Error('Client not found.');
    }

    if (client.status === 'blacklist') {
      throw new Error('Sales are blocked for blacklist clients.');
    }

    if (!product) {
      throw new Error('Product not found.');
    }

    const isSameProduct =
      existingSale.product.toString() === payload.productId;

    if (isSameProduct) {
      const availableQuantity =
        Math.max(product.quantity - product.reservedQuantity, 0) +
        existingSale.quantity;

      if (availableQuantity < payload.quantity) {
        throw new Error('Not enough free stock for this operation.');
      }
    } else {
      await ensureFreeStock(payload.productId, payload.quantity);
    }

    await applyProductQuantityDelta(existingSale.product, existingSale.quantity);

    try {
      const updatedProduct = await applyProductQuantityDelta(
        payload.productId,
        -payload.quantity,
      );

      const updatedSale = await Sale.findByIdAndUpdate(
        saleId,
        {
          saleDate: payload.saleDate,
          client: client._id,
          product: product._id,
          quantity: payload.quantity,
          salePrice: payload.salePrice,
          note: payload.note,
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
        },
        {
          new: true,
          runValidators: true,
        },
      ).lean<SaleDocument | null>();

      if (!updatedSale) {
        throw new Error('Sale not found.');
      }

      res.json({
        sale: formatSale(updatedSale),
        product: formatProduct(updatedProduct),
      });
    } catch (error) {
      await applyProductQuantityDelta(existingSale.product, -existingSale.quantity);
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

app.delete('/api/sales/:saleId', async (req, res, next) => {
  try {
    const { saleId } = req.params;
    isValidObjectIdOrThrow(saleId, 'saleId');

    const existingSale = await Sale.findById(saleId).lean<SaleDocument | null>();

    if (!existingSale) {
      throw new Error('Sale not found.');
    }

    await applyProductQuantityDelta(existingSale.product, existingSale.quantity);
    await Sale.findByIdAndDelete(saleId);

    res.json({ id: saleId, restoredProductId: existingSale.product.toString() });
  } catch (error) {
    next(error);
  }
});

app.post('/api/demo/seed', async (_req, res, next) => {
  try {
    await Promise.all([
      Sale.deleteMany({}),
      Client.deleteMany({}),
      Product.deleteMany({}),
    ]);

    const products = await Product.insertMany(createDemoProducts(), {
      ordered: true,
    });
    const clients = await Client.insertMany(createDemoClients(), {
      ordered: true,
    });

    const [
      mouseProduct,
      keyboardProduct,
      hubProduct,
      ssdProduct,
      monitorProduct,
      webcamProduct,
      speakerProduct,
      routerProduct,
      headsetProduct,
      powerBankProduct,
      standProduct,
      chargerProduct,
    ] = products;
    const [
      regularClient,
      wholesaleClient,
      vipClient,
      designClient,
      newClient,
      coworkingClient,
    ] = clients;

    if (
      !mouseProduct ||
      !keyboardProduct ||
      !hubProduct ||
      !ssdProduct ||
      !monitorProduct ||
      !webcamProduct ||
      !speakerProduct ||
      !routerProduct ||
      !headsetProduct ||
      !powerBankProduct ||
      !standProduct ||
      !chargerProduct ||
      !regularClient ||
      !wholesaleClient ||
      !vipClient ||
      !designClient ||
      !newClient ||
      !coworkingClient
    ) {
      throw new Error('Failed to build demo fixtures.');
    }

    const seededSalesPayload = [
      {
        saleDate: new Date('2026-01-08T09:12:00.000Z'),
        client: regularClient,
        product: mouseProduct,
        quantity: 2,
        salePrice: 649,
        note: 'Pickup from store before office opening.',
      },
      {
        saleDate: new Date('2026-01-21T16:45:00.000Z'),
        client: wholesaleClient,
        product: hubProduct,
        quantity: 4,
        salePrice: 1299,
        note: 'Batch order for accounting department laptops.',
      },
      {
        saleDate: new Date('2026-02-03T11:25:00.000Z'),
        client: vipClient,
        product: keyboardProduct,
        quantity: 1,
        salePrice: 2399,
        note: 'Discount approved for loyal client.',
      },
      {
        saleDate: new Date('2026-02-14T13:05:00.000Z'),
        client: designClient,
        product: webcamProduct,
        quantity: 2,
        salePrice: 2899,
        note: 'Needed for remote interviews and client calls.',
      },
      {
        saleDate: new Date('2026-03-11T18:20:00.000Z'),
        client: newClient,
        product: powerBankProduct,
        quantity: 3,
        salePrice: 1599,
        note: 'Evening walk-in purchase for travel.',
      },
      {
        saleDate: new Date('2026-03-28T10:40:00.000Z'),
        client: coworkingClient,
        product: routerProduct,
        quantity: 2,
        salePrice: 3299,
        note: 'Upgrade of Wi-Fi zone on the second floor.',
      },
      {
        saleDate: new Date('2026-04-05T12:30:00.000Z'),
        client: regularClient,
        product: standProduct,
        quantity: 2,
        salePrice: 999,
        note: 'Added ergonomic accessories to previous order.',
      },
      {
        saleDate: new Date('2026-04-18T10:30:00.000Z'),
        client: regularClient,
        product: chargerProduct,
        quantity: 1,
        salePrice: 1199,
        note: 'Added wireless charger during pickup.',
      },
      {
        saleDate: new Date('2026-05-07T15:00:00.000Z'),
        client: vipClient,
        product: ssdProduct,
        quantity: 1,
        salePrice: 3999,
        note: 'Urgent same-day replacement for backup drive.',
      },
      {
        saleDate: new Date('2026-05-24T17:35:00.000Z'),
        client: wholesaleClient,
        product: monitorProduct,
        quantity: 3,
        salePrice: 8999,
        note: 'Monitors for newly hired office staff.',
      },
      {
        saleDate: new Date('2026-06-09T08:50:00.000Z'),
        client: designClient,
        product: speakerProduct,
        quantity: 1,
        salePrice: 4299,
        note: 'Requested before a team event.',
      },
      {
        saleDate: new Date('2026-06-30T14:10:00.000Z'),
        client: coworkingClient,
        product: headsetProduct,
        quantity: 5,
        salePrice: 2299,
        note: 'Headsets for new call booths.',
      },
      {
        saleDate: new Date('2026-07-12T19:05:00.000Z'),
        client: newClient,
        product: mouseProduct,
        quantity: 1,
        salePrice: 699,
        note: 'Late purchase right before closing.',
      },
      {
        saleDate: new Date('2026-07-26T11:18:00.000Z'),
        client: regularClient,
        product: powerBankProduct,
        quantity: 2,
        salePrice: 1699,
        note: 'Bought extra units for family travel.',
      },
      {
        saleDate: new Date('2026-08-04T09:40:00.000Z'),
        client: coworkingClient,
        product: standProduct,
        quantity: 6,
        salePrice: 999,
        note: 'Workplace refresh for hot-desk area.',
      },
      {
        saleDate: new Date('2026-08-19T16:55:00.000Z'),
        client: wholesaleClient,
        product: webcamProduct,
        quantity: 3,
        salePrice: 2799,
        note: 'Bulk procurement for training room.',
      },
      {
        saleDate: new Date('2026-09-03T10:15:00.000Z'),
        client: vipClient,
        product: monitorProduct,
        quantity: 1,
        salePrice: 9299,
        note: 'Premium unit reserved for a loyal client.',
      },
      {
        saleDate: new Date('2026-09-18T12:05:00.000Z'),
        client: designClient,
        product: ssdProduct,
        quantity: 2,
        salePrice: 3899,
        note: 'Portable drives for project archive transfer.',
      },
      {
        saleDate: new Date('2026-10-07T13:48:00.000Z'),
        client: regularClient,
        product: hubProduct,
        quantity: 1,
        salePrice: 1399,
        note: 'Needed HDMI and SD card support for a laptop.',
      },
      {
        saleDate: new Date('2026-10-29T18:42:00.000Z'),
        client: newClient,
        product: speakerProduct,
        quantity: 1,
        salePrice: 4499,
        note: 'Gift purchase in the evening.',
      },
      {
        saleDate: new Date('2026-11-15T11:11:00.000Z'),
        client: coworkingClient,
        product: routerProduct,
        quantity: 2,
        salePrice: 3199,
        note: 'Expanded network coverage before winter season.',
      },
      {
        saleDate: new Date('2026-11-27T09:30:00.000Z'),
        client: wholesaleClient,
        product: chargerProduct,
        quantity: 5,
        salePrice: 1199,
        note: 'Black Friday accessory batch.',
      },
      {
        saleDate: new Date('2026-12-06T14:22:00.000Z'),
        client: vipClient,
        product: keyboardProduct,
        quantity: 2,
        salePrice: 2499,
        note: 'Holiday gifts approved at standard price.',
      },
      {
        saleDate: new Date('2026-12-19T17:08:00.000Z'),
        client: designClient,
        product: headsetProduct,
        quantity: 2,
        salePrice: 2399,
        note: 'Year-end studio equipment refresh.',
      },
      {
        saleDate: new Date('2026-12-28T15:40:00.000Z'),
        client: regularClient,
        product: powerBankProduct,
        quantity: 4,
        salePrice: 1599,
        note: 'Pre-trip bundle at the end of the year.',
      },
    ];

    const sales = await Promise.all(
      seededSalesPayload.map(async (entry) => {
        await Product.findByIdAndUpdate(entry.product._id, {
          $inc: {
            quantity: -entry.quantity,
          },
        });

        const sale = new Sale({
          saleDate: entry.saleDate,
          client: entry.client._id,
          product: entry.product._id,
          quantity: entry.quantity,
          salePrice: entry.salePrice,
          note: entry.note,
          productSnapshot: {
            article: entry.product.article,
            name: entry.product.name,
            serialNumber: entry.product.serialNumber,
          },
          clientSnapshot: {
            name: entry.client.name,
            phone: entry.client.phone,
            status: entry.client.status,
          },
        });

        await sale.save();
        return sale;
      }),
    );

    const freshProducts = await Product.find().sort({ createdAt: -1 }).lean<ProductDocument[]>();
    const freshClients = await Client.find().sort({ createdAt: -1 }).lean<ClientDocument[]>();
    const freshSales = await Sale.find().sort({ saleDate: -1 }).lean<SaleDocument[]>();

    res.status(201).json({
      message: `Demo data created: ${products.length} products, ${clients.length} clients, ${sales.length} sales.`,
      products: freshProducts.map(formatProduct),
      clients: freshClients.map(formatClient),
      sales: freshSales.map(formatSale),
    });
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode =
    error instanceof mongoose.Error.ValidationError || isDuplicateKeyError(error) ? 400 : 500;
  const message = getErrorMessage(error);

  if (statusCode === 500) {
    console.error(error);
  }

  res.status(statusCode).json({ message });
});

const startServer = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    app.listen(PORT, () => {
      console.log(`Backend started on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start backend', error);
    process.exit(1);
  }
};

void startServer();
