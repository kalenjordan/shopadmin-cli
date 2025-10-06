import { createShopifyClient } from '../shopify-client';
import { formatShopName } from '../utils/colors';
import { Shop } from '../types';
import { GET_PRODUCT_BY_HANDLE, GET_PRODUCT_BY_ID } from '../graphql/products';
import chalk from 'chalk';

interface CommandOptions {
  shop: Shop;
  handleOrId: string;
  verbose?: boolean;
}

function transformProductData(product: any) {
  // Transform product data to flatten edges/nodes structure
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    descriptionHtml: product.descriptionHtml,
    handle: product.handle,
    status: product.status,
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    publishedAt: product.publishedAt,
    onlineStoreUrl: product.onlineStoreUrl,
    featuredImage: product.featuredImage,
    media: product.media?.edges?.map((edge: any) => edge.node) || [],
    variants: product.variants?.edges?.map((edge: any) => ({
      ...edge.node,
      metafields: edge.node.metafields?.edges?.map((mfEdge: any) => mfEdge.node) || []
    })) || [],
    metafields: product.metafields?.edges?.map((edge: any) => edge.node) || [],
    options: product.options,
    seo: product.seo
  };
}

export async function getProduct(options: CommandOptions) {
  const { shop, handleOrId, verbose = false } = options;

  try {
    const client = createShopifyClient(shop);

    // Determine if input is an ID (starts with gid://) or a handle
    const isId = handleOrId.startsWith('gid://');

    if (verbose) {
      console.log(`\n${chalk.cyan('Fetching product from')} ${formatShopName(shop.name)}`);
      console.log(chalk.gray(`${isId ? 'ID' : 'Handle'}: ${handleOrId}`));
      console.log('');
    }

    let response;
    let product;

    if (isId) {
      response = await client.request(GET_PRODUCT_BY_ID, {
        variables: { id: handleOrId }
      });

      if (verbose) {
        console.log(chalk.gray('GraphQL Response:'), JSON.stringify(response, null, 2));
      }

      product = response.data?.product;
    } else {
      response = await client.request(GET_PRODUCT_BY_HANDLE, {
        variables: { handle: handleOrId }
      });

      if (verbose) {
        console.log(chalk.gray('GraphQL Response:'), JSON.stringify(response, null, 2));
      }

      product = response.data?.productByHandle;
    }

    if (!product) {
      console.error(chalk.red(`Product not found: ${handleOrId}`));
      process.exit(1);
    }

    // Transform and output as JSON
    const transformedProduct = transformProductData(product);
    console.log(JSON.stringify(transformedProduct, null, 2));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error fetching product:'), errorMessage);
    if (verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}
