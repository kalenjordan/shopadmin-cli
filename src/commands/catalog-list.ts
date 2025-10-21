import { createShopifyClient } from '../shopify-client';
import { formatShopName } from '../utils/colors';
import { Shop } from '../types';
import { LIST_CATALOGS } from '../graphql/catalogs';
import chalk from 'chalk';
import Table from 'cli-table3';

interface CommandOptions {
  shop: Shop;
  limit?: string;
  verbose?: boolean;
}

export async function listCatalogs(options: CommandOptions) {
  const { shop, limit = '50', verbose = false } = options;
  const first = parseInt(limit, 10);

  if (isNaN(first) || first < 1) {
    console.error(chalk.red('Invalid limit value. Must be a positive number.'));
    process.exit(1);
  }

  try {
    const client = createShopifyClient(shop);

    console.log(`\n${chalk.cyan('Catalogs from')} ${formatShopName(shop.name)}\n`);

    const response = await client.request(LIST_CATALOGS, {
      variables: {
        first
      }
    });

    if (verbose) {
      console.log(chalk.gray('GraphQL Response:'), JSON.stringify(response, null, 2));
    }

    if (!response.data?.catalogs?.edges || response.data.catalogs.edges.length === 0) {
      console.log(chalk.yellow('No catalogs found'));
      return;
    }

    const catalogs = response.data.catalogs.edges.map((edge: any) => edge.node);

    // Create table
    const table = new Table({
      head: [
        chalk.bold('ID'),
        chalk.bold('Title'),
        chalk.bold('Status')
      ],
      colWidths: [55, 60, 12]
    });

    // Add rows
    catalogs.forEach((catalog: any) => {
      const statusColor = catalog.status === 'ACTIVE' ? chalk.green : chalk.yellow;

      table.push([
        catalog.id,
        catalog.title || chalk.gray('(no title)'),
        statusColor(catalog.status)
      ]);
    });

    console.log(table.toString());
    console.log('');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error fetching catalogs:'), errorMessage);
    if (verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}
