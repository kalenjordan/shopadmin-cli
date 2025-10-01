import { createShopifyClient, ShopifyClient } from '../shopify-client';
import { formatShopName } from '../utils/colors';
import { Shop } from '../types';
import { SEARCH_CUSTOMERS, SEARCH_PRODUCTS, CREATE_DRAFT_ORDER, COMPLETE_DRAFT_ORDER } from '../graphql/orders';
import chalk from 'chalk';
import inquirer from 'inquirer';

interface CommandOptions {
  shop: Shop;
  verbose?: boolean;
}

interface Address {
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  zip: string | null;
  phone: string | null;
}

interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string | null;
  numberOfOrders: number;
  defaultAddress: Address | null;
}

interface Product {
  id: string;
  title: string;
  status: string;
  handle: string;
  totalInventory: number;
  variants: Variant[];
}

interface Variant {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity: number;
  availableForSale: boolean;
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
}

export async function createOrder(options: CommandOptions) {
  const { shop, verbose = false } = options;

  try {
    const client = createShopifyClient(shop);

    console.log(`\n${chalk.cyan('Creating order for')} ${formatShopName(shop.name)}\n`);

    // Step 1: Search and select customer
    const customer = await selectCustomer(client, verbose);
    console.log(chalk.green(`✓ Selected customer: ${customer.displayName} (${customer.email})`));

    // Step 2: Search and select products
    const lineItems = await selectProducts(client, verbose);
    console.log(chalk.green(`✓ Selected ${lineItems.length} product(s)`));

    // Step 3: Create draft order
    console.log(chalk.cyan('\nCreating draft order...'));

    interface DraftOrderInput {
      customerId: string;
      email: string;
      lineItems: Array<{ variantId: string; quantity: number }>;
      shippingAddress?: {
        address1: string | null;
        address2: string | null;
        city: string | null;
        province: string | null;
        country: string | null;
        zip: string | null;
        phone: string | null;
        firstName: string;
        lastName: string;
      };
    }

    const draftOrderInput: DraftOrderInput = {
      customerId: customer.id,
      email: customer.email,
      lineItems: lineItems.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity
      }))
    };

    // Add shipping address if available
    if (customer.defaultAddress) {
      draftOrderInput.shippingAddress = {
        address1: customer.defaultAddress.address1,
        address2: customer.defaultAddress.address2,
        city: customer.defaultAddress.city,
        province: customer.defaultAddress.province,
        country: customer.defaultAddress.country,
        zip: customer.defaultAddress.zip,
        phone: customer.defaultAddress.phone,
        firstName: customer.firstName,
        lastName: customer.lastName
      };
    }

    const draftOrderResponse = await client.request(CREATE_DRAFT_ORDER, {
      variables: { input: draftOrderInput }
    });

    interface UserError {
      field?: string[];
      message: string;
    }

    if (draftOrderResponse.data.draftOrderCreate.userErrors.length > 0) {
      const errors = draftOrderResponse.data.draftOrderCreate.userErrors
        .map((e: UserError) => `${e.field?.join('.')}: ${e.message}`)
        .join('\n');
      throw new Error(`Draft order creation failed:\n${errors}`);
    }

    const draftOrder = draftOrderResponse.data.draftOrderCreate.draftOrder;
    console.log(chalk.green(`✓ Draft order created: ${draftOrder.name}`));

    if (verbose) {
      console.log(chalk.gray(`  ID: ${draftOrder.id}`));
      console.log(chalk.gray(`  Status: ${draftOrder.status}`));
      console.log(chalk.gray(`  Total: ${draftOrder.totalPrice}`));
    }

    // Step 4: Ask if user wants to complete the order
    const { completeOrder } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'completeOrder',
        message: 'Complete the draft order (convert to order)?',
        default: true
      }
    ]);

    if (completeOrder) {
      console.log(chalk.cyan('\nCompleting draft order...'));

      const completeResponse = await client.request(COMPLETE_DRAFT_ORDER, {
        variables: {
          id: draftOrder.id,
          paymentPending: true
        }
      });

      if (completeResponse.data.draftOrderComplete.userErrors.length > 0) {
        const errors = completeResponse.data.draftOrderComplete.userErrors
          .map((e: UserError) => `${e.field?.join('.')}: ${e.message}`)
          .join('\n');
        throw new Error(`Order completion failed:\n${errors}`);
      }

      const order = completeResponse.data.draftOrderComplete.draftOrder.order;
      console.log(chalk.green(`\n✓ Order created successfully!`));
      console.log(chalk.gray(`  Order: ${order.name}`));
      console.log(chalk.gray(`  ID: ${order.id}`));
      console.log(chalk.gray(`  Total: ${order.totalPriceSet.shopMoney.amount} ${order.totalPriceSet.shopMoney.currencyCode}`));
      console.log(chalk.gray(`  Created: ${new Date(order.createdAt).toLocaleString()}`));
    } else {
      console.log(chalk.yellow(`\nDraft order ${draftOrder.name} created but not completed.`));
      console.log(chalk.gray(`You can complete it later in the Shopify admin.`));
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('\n❌ Error creating order:'), errorMessage);
    if (verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

async function selectCustomer(client: ShopifyClient, verbose: boolean): Promise<Customer> {
  if (verbose) {
    console.log(chalk.gray('Fetching customers...'));
  }

  // Fetch first 50 customers
  const response = await client.request(SEARCH_CUSTOMERS, {
    variables: {
      query: '',
      first: 50
    }
  });

  interface CustomerEdge {
    node: Customer;
  }

  const customers = response.data.customers.edges.map((edge: CustomerEdge) => edge.node);

  if (customers.length === 0) {
    throw new Error('No customers found in your store. Please create a customer first.');
  }

  const { customerId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'customerId',
      message: 'Select a customer:',
      choices: customers.map((c: Customer) => ({
        name: `${c.displayName} - ${c.email} (${c.numberOfOrders} orders)`,
        value: c.id
      }))
    }
  ]);

  return customers.find((c: Customer) => c.id === customerId);
}

async function selectProducts(client: ShopifyClient, verbose: boolean): Promise<Array<{ variantId: string; quantity: number }>> {
  const lineItems: Array<{ variantId: string; quantity: number; productTitle: string; variantTitle: string; price: string }> = [];
  let addMore = true;

  // Fetch all products once
  if (verbose) {
    console.log(chalk.gray('Fetching products...'));
  }

  const response = await client.request(SEARCH_PRODUCTS, {
    variables: {
      query: 'status:active',
      first: 50
    }
  });

  interface VariantEdge {
    node: Variant;
  }

  interface ProductEdge {
    node: Product & {
      variants: {
        edges: VariantEdge[];
      };
    };
  }

  const products = response.data.products.edges.map((edge: ProductEdge) => ({
    ...edge.node,
    variants: edge.node.variants.edges.map((v: VariantEdge) => v.node)
  }));

  if (products.length === 0) {
    throw new Error('No active products found in your store. Please create products first.');
  }

  // Flatten products and variants for selection
  const variantChoices: Array<{ name: string; value: { product: Product; variant: Variant } }> = [];

  products.forEach((product: Product) => {
    product.variants.forEach((variant: Variant) => {
      const optionsStr = variant.selectedOptions
        .map(opt => opt.value)
        .join(' / ');
      const inventoryInfo = variant.availableForSale
        ? chalk.green(`✓ ${variant.inventoryQuantity} in stock`)
        : chalk.red('✗ Out of stock');

      variantChoices.push({
        name: `${product.title} - ${optionsStr} (${variant.price}) ${inventoryInfo}`,
        value: { product, variant }
      });
    });
  });

  while (addMore) {
    const { selectedVariant } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedVariant',
        message: 'Select a product variant:',
        choices: variantChoices
      }
    ]);

    const { quantity } = await inquirer.prompt([
      {
        type: 'number',
        name: 'quantity',
        message: 'Quantity:',
        default: 1,
        validate: (input) => {
          if (input < 1) return 'Quantity must be at least 1';
          if (!selectedVariant.variant.availableForSale) return 'Product is not available for sale';
          if (input > selectedVariant.variant.inventoryQuantity) {
            return `Only ${selectedVariant.variant.inventoryQuantity} items available`;
          }
          return true;
        }
      }
    ]);

    lineItems.push({
      variantId: selectedVariant.variant.id,
      quantity,
      productTitle: selectedVariant.product.title,
      variantTitle: selectedVariant.variant.title,
      price: selectedVariant.variant.price
    });

    console.log(chalk.green(`✓ Added ${quantity}x ${selectedVariant.product.title} - ${selectedVariant.variant.title}`));

    const { addAnother } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addAnother',
        message: 'Add another product?',
        default: false
      }
    ]);

    addMore = addAnother;
  }

  return lineItems;
}