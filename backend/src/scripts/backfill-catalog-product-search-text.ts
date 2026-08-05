import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { CatalogProduct } from '../domain/catalog-product/model';
import { rebuildCatalogProductSearchTexts } from '../domain/catalog-product/service';

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const run = async () => {
  const apply = hasFlag('apply');
  if (!apply) {
    console.log(
      'Dry run only lists counts. Re-run with --apply to rewrite stale searchText fields.',
    );
  }

  await connectDatabase();

  if (!apply) {
    const items = await CatalogProduct.find({}).lean();
    let stale = 0;
    for (const item of items) {
      const expected = [item.name, item.note].filter(Boolean).join(' ').toLowerCase();
      if ((item.searchText ?? '') !== expected) stale += 1;
    }
    console.log(
      JSON.stringify(
        { dryRun: true, scanned: items.length, stale, alreadyConsistent: items.length - stale },
        null,
        2,
      ),
    );
    return;
  }

  const result = await rebuildCatalogProductSearchTexts();
  console.log(JSON.stringify({ dryRun: false, ...result }, null, 2));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
