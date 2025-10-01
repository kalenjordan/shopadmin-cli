import { createShopifyClient, ShopifyClient } from '../shopify-client';
import { formatShopName } from '../utils/colors';
import { Shop } from '../types';
import { GET_ORDERS_WITH_CUSTOMER } from '../graphql/orders';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface CommandOptions {
  shop: Shop;
  output?: string;
  limit?: string;
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
  const { shop, output, limit = '5000', verbose = false } = options;
  const maxOrders = parseInt(limit, 10);

  if (isNaN(maxOrders) || maxOrders <= 0) {
    throw new Error('Limit must be a positive number');
  }

  try {
    const client = createShopifyClient(shop);

    console.log(`\n${chalk.cyan('Fetching orders from')} ${formatShopName(shop.name)}...\n`);

    // Fetch all orders with customer information
    const orders = await fetchAllOrders(client, maxOrders, verbose);

    if (orders.length === 0) {
      console.log(chalk.yellow('No orders found.'));
      return;
    }

    console.log(chalk.green(`✓ Found ${orders.length} orders`));
    console.log(chalk.cyan('Grouping orders by customer...\n'));

    // Group orders by customer
    const customerMap = new Map<string, Customer>();

    for (const order of orders) {
      if (!order.customer) {
        if (verbose) {
          console.log(chalk.yellow(`  Order ${order.name} has no customer, skipping`));
        }
        continue;
      }

      const customerId = order.customer.id;

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          id: order.customer.id,
          email: order.customer.email,
          firstName: order.customer.firstName,
          lastName: order.customer.lastName,
          numberOfOrders: order.customer.numberOfOrders,
          orders: []
        });
      }

      const customer = customerMap.get(customerId)!;
      customer.orders!.push({
        id: order.id,
        name: order.name,
        createdAt: order.createdAt,
        totalPrice: order.totalPrice,
        lineItems: order.lineItems
      });
    }

    const customers = Array.from(customerMap.values());

    console.log(chalk.green(`✓ Grouped orders into ${customers.length} customers`));

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

    // Determine output file path - default to Desktop
    const defaultFileName = `customers-${Date.now()}.json`;
    const outputPath = output || path.join(os.homedir(), 'Desktop', defaultFileName);
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
    console.log(chalk.gray(`  Total orders: ${customers.reduce((sum, c) => sum + (c.orders?.length || 0), 0)}`));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Authentication failed')) {
      console.error('\n' + errorMessage);
    } else {
      console.error('\n❌ Error downloading customer data:', errorMessage);
      if (verbose && error instanceof Error && error.stack) {
        console.error(chalk.gray(error.stack));
      }
    }
    process.exit(1);
  }
}

interface OrderWithCustomer {
  id: string;
  name: string;
  createdAt: string;
  totalPrice: {
    amount: string;
    currencyCode: string;
  };
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    numberOfOrders: number;
  } | null;
  lineItems: LineItem[];
}

async function fetchAllOrders(
  client: ShopifyClient,
  maxOrders: number,
  verbose: boolean
): Promise<OrderWithCustomer[]> {
  const allOrders: OrderWithCustomer[] = [];
  let cursor: string | null = null;
  let hasMore = true;
  let page = 0;

  while (hasMore && allOrders.length < maxOrders) {
    page++;
    console.log(chalk.gray(`Fetching orders batch ${page}...`));

    const remainingToFetch = maxOrders - allOrders.length;
    const batchSize = Math.min(250, remainingToFetch);

    const response = await client.request(GET_ORDERS_WITH_CUSTOMER, {
      variables: {
        numOrders: batchSize,
        cursor
      }
    });

    interface LineItemEdge {
      node: {
        id: string;
        title: string;
        sku: string | null;
        quantity: number;
        originalUnitPriceSet: {
          shopMoney: {
            amount: string;
            currencyCode: string;
          };
        };
        variant: {
          id: string;
          title: string;
          selectedOptions: Array<{ name: string; value: string }>;
        } | null;
      };
    }

    interface OrderEdge {
      node: {
        id: string;
        name: string;
        createdAt: string;
        totalPriceSet: {
          shopMoney: {
            amount: string;
            currencyCode: string;
          };
        };
        customer: {
          id: string;
          email: string;
          firstName: string | null;
          lastName: string | null;
          numberOfOrders: number;
        } | null;
        lineItems: {
          edges: LineItemEdge[];
        };
      };
    }

    const edges = response.data.orders.edges;
    const orders = edges.map((edge: OrderEdge) => {
      const node = edge.node;
      return {
        id: node.id,
        name: node.name,
        createdAt: node.createdAt,
        totalPrice: {
          amount: node.totalPriceSet.shopMoney.amount,
          currencyCode: node.totalPriceSet.shopMoney.currencyCode
        },
        customer: node.customer,
        lineItems: node.lineItems.edges.map((lineItemEdge: LineItemEdge) => {
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

    const pageInfo = response.data.orders.pageInfo;
    hasMore = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;

    console.log(chalk.gray(`  ✓ Fetched ${orders.length} orders (total: ${allOrders.length})`));
  }

  return allOrders;
}