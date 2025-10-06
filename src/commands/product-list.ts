import { createShopifyClient } from '../shopify-client';
import { formatShopName } from '../utils/colors';
import { Shop } from '../types';
import { LIST_PRODUCTS } from '../graphql/products';
import chalk from 'chalk';
import Table from 'cli-table3';

interface CommandOptions {
  shop: Shop;
  limit?: string;
  verbose?: boolean;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export async function listProducts(options: CommandOptions) {
  const { shop, limit = '5', verbose = false } = options;
  const first = parseInt(limit, 10);

  if (isNaN(first) || first < 1) {
    console.error(chalk.red('Invalid limit value. Must be a positive number.'));
    process.exit(1);
  }

  try {
    const client = createShopifyClient(shop);

    console.log(`\n${chalk.cyan('Products from')} ${formatShopName(shop.name)}\n`);

    const response = await client.request(LIST_PRODUCTS, {
      variables: {
        first,
        sortKey: 'UPDATED_AT',
        reverse: true
      }
    });

    if (verbose) {
      console.log(chalk.gray('GraphQL Response:'), JSON.stringify(response, null, 2));
    }

    if (!response.data?.products?.edges || response.data.products.edges.length === 0) {
      console.log(chalk.yellow('No products found'));
      return;
    }

    const products = response.data.products.edges.map((edge: any) => edge.node);

    // Create table
    const table = new Table({
      head: [
        chalk.bold('Title'),
        chalk.bold('Handle'),
        chalk.bold('Status'),
        chalk.bold('Updated')
      ],
      colWidths: [40, 30, 12, 15]
    });

    // Add rows
    products.forEach((product: any) => {
      const statusColor = product.status === 'ACTIVE' ? chalk.green : chalk.yellow;

      table.push([
        product.title,
        product.handle,
        statusColor(product.status),
        formatDate(product.updatedAt)
      ]);
    });

    console.log(table.toString());
    console.log('');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error fetching products:'), errorMessage);
    if (verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}
