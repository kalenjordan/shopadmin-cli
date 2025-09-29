import { createShopifyClient } from '../shopify-client';
import { formatShopName } from '../utils/colors';
import { Shop } from '../types';
import { GET_CUSTOMERS_WITH_ORDER_COUNT, GET_CUSTOMER_ORDERS } from '../graphql/customers';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

interface CommandOptions {
  shop: Shop;
  output?: string;
  verbose?: boolean;
}

interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  numberOfOrders: number;
  orders?: Order[];
}

interface Order {
  id: string;
  name: string;
  createdAt: string;
  totalPrice: {
    amount: string;
    currencyCode: string;
  };
  lineItems: LineItem[];
}

interface LineItem {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  price: {
    amount: string;
    currencyCode: string;
  };
  variant: {
    id: string;
    title: string;
    options: Array<{
      name: string;
      value: string;
    }>;
  } | null;
}

export async function downloadCustomers(options: CommandOptions) {
  const { shop, output, verbose = false } = options;

  try {
    const client = createShopifyClient(shop);

    console.log(`\n${chalk.cyan('Fetching customers with orders from')} ${formatShopName(shop.name)}...\n`);

    // Fetch all customers with at least one order
    const customers = await fetchAllCustomers(client, verbose);

    if (customers.length === 0) {
      console.log(chalk.yellow('No customers with orders found.'));
      return;
    }

    console.log(chalk.green(`✓ Found ${customers.length} customers with orders`));
    console.log(chalk.cyan('Fetching order details...\n'));

    // Fetch orders for each customer
    let processedCustomers = 0;
    for (const customer of customers) {
      if (verbose) {
        console.log(chalk.gray(`Fetching orders for customer ${customer.email}...`));
      }

      const orders = await fetchAllOrdersForCustomer(client, customer.id, verbose);
      customer.orders = orders;

      processedCustomers++;
      if (!verbose && processedCustomers % 10 === 0) {
        console.log(chalk.gray(`Progress: ${processedCustomers}/${customers.length} customers processed`));
      }
    }

    console.log(chalk.green(`✓ Fetched orders for all ${customers.length} customers`));

    // Transform data to desired format
    const exportData = customers.map(customer => ({
      id: customer.id.split('/').pop(),
      totalOrders: customer.numberOfOrders,
      orders: customer.orders?.map(order => ({
        name: order.name,
        createdAt: order.createdAt,
        totalPrice: order.totalPrice.amount,
        currency: order.totalPrice.currencyCode,
        items: order.lineItems.map(item => ({
          title: item.title,
          sku: item.sku,
          quantity: item.quantity,
          price: item.price.amount,
          currency: item.price.currencyCode,
          variantTitle: item.variant?.title || null,
          options: item.variant?.options || []
        }))
      })) || []
    }));

    // Determine output file path
    const outputPath = output || `customers-${Date.now()}.json`;
    const absolutePath = path.isAbsolute(outputPath)
      ? outputPath
      : path.join(process.cwd(), outputPath);

    // Write to file
    await fs.writeFile(
      absolutePath,
      JSON.stringify(exportData, null, 2),
      'utf-8'
    );

    console.log(chalk.green(`\n✓ Customer data exported successfully`));
    console.log(chalk.gray(`  File: ${absolutePath}`));
    console.log(chalk.gray(`  Customers: ${customers.length}`));
    console.log(chalk.gray(`  Total orders: ${customers.reduce((sum, c) => sum + c.numberOfOrders, 0)}`));

  } catch (error: any) {
    if (error.message?.includes('Authentication failed')) {
      console.error('\n' + error.message);
    } else {
      console.error('\n❌ Error downloading customer data:', error.message || error);
      if (verbose && error.stack) {
        console.error(chalk.gray(error.stack));
      }
    }
    process.exit(1);
  }
}

async function fetchAllCustomers(
  client: any,
  verbose: boolean
): Promise<Customer[]> {
  const allCustomers: Customer[] = [];
  let cursor: string | null = null;
  let hasMore = true;
  let page = 0;

  while (hasMore) {
    page++;
    if (verbose) {
      console.log(chalk.gray(`Fetching customers page ${page}...`));
    }

    const response = await client.request(GET_CUSTOMERS_WITH_ORDER_COUNT, {
      variables: {
        numCustomers: 250,
        cursor,
        query: 'orders_count:>0'
      }
    });

    const edges = response.data.customers.edges;
    const customers = edges.map((edge: any) => edge.node);
    allCustomers.push(...customers);

    const pageInfo = response.data.customers.pageInfo;
    hasMore = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;

    if (verbose) {
      console.log(chalk.gray(`  Got ${customers.length} customers (total: ${allCustomers.length})`));
    }
  }

  return allCustomers;
}

async function fetchAllOrdersForCustomer(
  client: any,
  customerId: string,
  verbose: boolean
): Promise<Order[]> {
  const allOrders: Order[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const response = await client.request(GET_CUSTOMER_ORDERS, {
      variables: {
        customerId,
        numOrders: 100,
        cursor
      }
    });

    const edges = response.data.customer.orders.edges;
    const orders = edges.map((edge: any) => {
      const node = edge.node;
      return {
        id: node.id,
        name: node.name,
        createdAt: node.createdAt,
        totalPrice: {
          amount: node.totalPriceSet.shopMoney.amount,
          currencyCode: node.totalPriceSet.shopMoney.currencyCode
        },
        lineItems: node.lineItems.edges.map((lineItemEdge: any) => {
          const item = lineItemEdge.node;
          return {
            id: item.id,
            title: item.title,
            sku: item.sku,
            quantity: item.quantity,
            price: {
              amount: item.originalUnitPriceSet.shopMoney.amount,
              currencyCode: item.originalUnitPriceSet.shopMoney.currencyCode
            },
            variant: item.variant ? {
              id: item.variant.id,
              title: item.variant.title,
              options: item.variant.selectedOptions
            } : null
          };
        })
      };
    });

    allOrders.push(...orders);

    const pageInfo = response.data.customer.orders.pageInfo;
    hasMore = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return allOrders;
}