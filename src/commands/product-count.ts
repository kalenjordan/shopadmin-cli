import { createShopifyClient } from '../shopify-client';
import { formatShopName } from '../utils/colors';
import { Shop } from '../types';
import { COUNT_PRODUCTS } from '../graphql/products';
import chalk from 'chalk';

interface CommandOptions {
  shop: Shop;
  active?: boolean;
  verbose?: boolean;
}

export async function countProducts(options: CommandOptions) {
  const { shop, active = false, verbose = false } = options;

  try {
    const client = createShopifyClient(shop);

    const query = active ? 'status:active' : undefined;

    console.log(`\n${chalk.cyan('Counting products from')} ${formatShopName(shop.name)}`);
    if (active) {
      console.log(chalk.gray('Filter: Active products only'));
    }

    const response = await client.request(COUNT_PRODUCTS, {
      variables: { query }
    });

    if (verbose) {
      console.log(chalk.gray('\nGraphQL Response:'), JSON.stringify(response, null, 2));
    }

    const count = response.data?.productsCount?.count ?? 0;

    console.log(chalk.green(`\nTotal: ${count} product${count !== 1 ? 's' : ''}\n`));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error counting products:'), errorMessage);
    if (verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}
