import inquirer from 'inquirer';
import { createShopifyClient, ShopifyClient } from '../shopify-client';
import { Shop } from '../types';
import {
  GET_PRODUCTS_WITH_UNSTRUCTURED_METAFIELDS,
  GET_VARIANTS_WITH_UNSTRUCTURED_METAFIELDS,
  CREATE_METAFIELD_DEFINITION,
  DELETE_METAFIELD_DEFINITION,
  GET_METAFIELD_DEFINITIONS
} from '../graphql/metafields';
import {
  ProductsResponse,
  VariantsResponse,
  Metafield,
  Product,
  ProductVariant,
  ResourceType,
  OwnerType,
  MetafieldDefinitionsResponse,
  CreateMetafieldDefinitionResponse,
  DeleteMetafieldDefinitionResponse
} from '../types/graphql';
import { parseGraphQLErrors, handleError } from '../utils/errors';
import { DELAYS, LINE_SEPARATORS, TYPE_MAPPINGS } from '../constants';

interface CommandOptions {
  verbose?: boolean;
  force?: boolean;
  shop: Shop;
  resourceType?: ResourceType;
}

interface UnstructuredResource {
  resource: Product | ProductVariant;
  metafields: ProcessedMetafield[];
}

interface ProcessedMetafield extends Metafield {
  resourceTitle: string;
  resourceHandle: string;
}

interface ScanResult {
  foundResource: UnstructuredResource | null;
  hasNextPage: boolean;
  nextCursor: string | null;
  batchSize: number;
}

function getOwnerType(resourceType: ResourceType): OwnerType {
  return resourceType === 'variant' ? 'PRODUCTVARIANT' : 'PRODUCT';
}

function getResourceTitle(resource: Product | ProductVariant, isVariant: boolean): string {
  if (isVariant) {
    const variant = resource as ProductVariant;
    return `${variant.product.title} - ${variant.title || variant.sku}`;
  }
  return (resource as Product).title;
}

function getResourceHandle(resource: Product | ProductVariant, isVariant: boolean): string {
  if (isVariant) {
    return (resource as ProductVariant).product.handle;
  }
  return (resource as Product).handle;
}

async function scanBatch(
  client: ShopifyClient,
  cursor: string | null,
  resourceType: ResourceType,
  verbose: boolean
): Promise<ScanResult> {
  const isVariant = resourceType === 'variant';

  if (verbose) {
    console.log(`\n--- Fetching batch of ${isVariant ? 'variants' : 'products'} ---`);
    console.log('Cursor:', cursor || 'start');
  }

  const query = isVariant ? GET_VARIANTS_WITH_UNSTRUCTURED_METAFIELDS : GET_PRODUCTS_WITH_UNSTRUCTURED_METAFIELDS;
  const response = await client.request(query, { variables: { cursor } }) as (ProductsResponse | VariantsResponse);

  if (verbose) {
    console.log('Response:', JSON.stringify(response, null, 2));
  }

  if (response.errors) {
    const errorInfo = parseGraphQLErrors(response.errors);
    throw new Error(errorInfo.message);
  }

  const data = isVariant
    ? (response as VariantsResponse).data?.productVariants
    : (response as ProductsResponse).data?.products;

  if (!data?.edges?.length) {
    return {
      foundResource: null,
      hasNextPage: false,
      nextCursor: null,
      batchSize: 0
    };
  }

  // Look for first resource with unstructured metafields
  for (const edge of data.edges) {
    const resource = edge.node;
    const unstructuredMetafields = resource.metafields.edges
      .filter((mf: { node: Metafield }) => !mf.node.definition)
      .map((mf: { node: Metafield }) => ({
        ...mf.node,
        resourceTitle: getResourceTitle(resource, isVariant),
        resourceHandle: getResourceHandle(resource, isVariant)
      }));

    if (unstructuredMetafields.length > 0) {
      return {
        foundResource: {
          resource,
          metafields: unstructuredMetafields
        },
        hasNextPage: data.pageInfo.hasNextPage,
        nextCursor: data.pageInfo.endCursor,
        batchSize: data.edges.length
      };
    }
  }

  return {
    foundResource: null,
    hasNextPage: data.pageInfo.hasNextPage,
    nextCursor: data.pageInfo.endCursor,
    batchSize: data.edges.length
  };
}

async function checkExistingDefinition(
  client: ShopifyClient,
  namespace: string,
  key: string,
  ownerType: OwnerType
): Promise<string | null> {
  const response = await client.request(GET_METAFIELD_DEFINITIONS, {
    variables: { namespace, key, ownerType }
  }) as MetafieldDefinitionsResponse;

  if (response.data.metafieldDefinitions.edges.length > 0) {
    return response.data.metafieldDefinitions.edges[0].node.id;
  }
  return null;
}

async function createTemporaryDefinition(
  client: ShopifyClient,
  metafield: ProcessedMetafield,
  ownerType: OwnerType
): Promise<string> {
  const mappedType = TYPE_MAPPINGS[metafield.type] || metafield.type;

  const response = await client.request(CREATE_METAFIELD_DEFINITION, {
    variables: {
      definition: {
        namespace: metafield.namespace,
        key: metafield.key,
        name: `${metafield.namespace} ${metafield.key}`,
        type: mappedType,
        ownerType
      }
    }
  }) as CreateMetafieldDefinitionResponse;

  if (response.data.metafieldDefinitionCreate.userErrors.length > 0) {
    const errors = response.data.metafieldDefinitionCreate.userErrors;
    throw new Error(`Failed to create definition: ${errors.map(e => e.message).join(', ')}`);
  }

  return response.data.metafieldDefinitionCreate.createdDefinition.id;
}

async function deleteDefinitionAndMetafields(
  client: ShopifyClient,
  definitionId: string
): Promise<void> {
  const response = await client.request(DELETE_METAFIELD_DEFINITION, {
    variables: {
      id: definitionId,
      deleteAllAssociatedMetafields: true
    }
  }) as DeleteMetafieldDefinitionResponse;

  if (response.data.metafieldDefinitionDelete.userErrors.length > 0) {
    const errors = response.data.metafieldDefinitionDelete.userErrors;
    throw new Error(`Failed to delete definition: ${errors.map(e => e.message).join(', ')}`);
  }
}

async function processMetafield(
  client: ShopifyClient,
  metafield: ProcessedMetafield,
  ownerType: OwnerType,
  force: boolean,
  isVariant: boolean
): Promise<boolean> {
  const metafieldKey = `${metafield.namespace}:${metafield.key}`;

  console.log('\n' + LINE_SEPARATORS.SECTION);
  console.log(`\nMetafield: ${metafieldKey}`);
  console.log(`Type: ${metafield.type}`);
  console.log(`${isVariant ? 'Variant' : 'Product'}: "${metafield.resourceTitle}" (${metafield.resourceHandle})`);

  const valuePreview = metafield.value.length > 200
    ? metafield.value.substring(0, 200) + '...'
    : metafield.value;
  console.log(`Value: ${valuePreview}\n`);

  let shouldDelete = force;

  if (!force) {
    const response = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldDelete',
      message: `Delete ALL instances of ${metafieldKey} across ALL ${isVariant ? 'variants' : 'products'}?`,
      default: false
    }]);
    shouldDelete = response.shouldDelete;
  } else {
    console.log(`🔥 Force mode: Automatically deleting ${metafieldKey}`);
  }

  if (!shouldDelete) {
    console.log('Skipped.');
    return false;
  }

  console.log(`\nDeleting all instances of ${metafieldKey}...`);

  try {
    // Check for existing definition or create temporary one
    let definitionId = await checkExistingDefinition(client, metafield.namespace, metafield.key, ownerType);

    if (definitionId) {
      console.log('Found existing definition, will delete it along with all metafields...');
    } else {
      definitionId = await createTemporaryDefinition(client, metafield, ownerType);
      console.log('Created temporary definition...');
    }

    // Delete the definition and all associated metafields
    await deleteDefinitionAndMetafields(client, definitionId);
    console.log(`✓ Successfully deleted all instances of ${metafieldKey}`);
    return true;
  } catch (error) {
    console.error(`Error processing ${metafieldKey}:`, error);
    return false;
  }
}

function printSummary(totalScanned: number, deletedCount: number, deletedMetafields: Set<string>, isVariant: boolean): void {
  console.log('\n' + LINE_SEPARATORS.THICK);
  console.log('\nSummary:');
  console.log(`- Scanned ${totalScanned} ${isVariant ? 'variant(s)' : 'product(s)'}`);
  console.log(`- Deleted ${deletedCount} metafield type(s)`);

  if (deletedMetafields.size > 0) {
    console.log('\nDeleted metafields:');
    deletedMetafields.forEach(key => console.log(`  - ${key}`));
  }
}

export async function deleteUnstructuredMetafields(options: CommandOptions): Promise<void> {
  const { verbose = false, force = false, shop, resourceType = 'product' } = options;
  const isVariant = resourceType === 'variant';
  const ownerType = getOwnerType(resourceType);

  try {
    const client = createShopifyClient(shop);

    if (force) {
      console.log('\n⚠️  FORCE MODE ENABLED - All unstructured metafields will be deleted automatically!');
      console.log('    This action cannot be undone. Press Ctrl+C to cancel.\n');
      await new Promise(resolve => setTimeout(resolve, DELAYS.FORCE_MODE_WARNING));
    }

    console.log(`\nScanning for ${isVariant ? 'variants' : 'products'} with unstructured metafields...\n`);

    let deletedCount = 0;
    let totalResourcesScanned = 0;
    const deletedMetafields = new Set<string>();
    let cursor: string | null = null;
    let shouldRestartScan = false;

    while (true) {
      if (shouldRestartScan) {
        cursor = null;
        shouldRestartScan = false;
        totalResourcesScanned = 0;
        console.log('\nRestarting scan from beginning after deletion...\n');
      }

      const scanResult = await scanBatch(client, cursor, resourceType, verbose);
      totalResourcesScanned += scanResult.batchSize;

      // Show progress
      if (scanResult.batchSize > 0) {
        process.stdout.write(`\rScanned ${totalResourcesScanned} ${isVariant ? 'variants' : 'products'}...`);
      }

      if (scanResult.foundResource) {
        const { resource, metafields } = scanResult.foundResource;
        const displayTitle = isVariant
          ? getResourceTitle(resource, true)
          : (resource as Product).title;

        console.log(`\n\nFound ${metafields.length} unstructured metafield(s) in ${isVariant ? 'variant' : 'product'}: "${displayTitle}"`);

        for (const metafield of metafields) {
          const metafieldKey = `${metafield.namespace}:${metafield.key}`;

          if (deletedMetafields.has(metafieldKey)) {
            console.log(`  Skipping ${metafieldKey} (already deleted)`);
            continue;
          }

          const wasDeleted = await processMetafield(client, metafield, ownerType, force, isVariant);

          if (wasDeleted) {
            deletedMetafields.add(metafieldKey);
            deletedCount++;
            shouldRestartScan = true;
          }
        }

        if (shouldRestartScan) {
          continue;
        }
      }

      if (!scanResult.hasNextPage) {
        console.log(`\n\n✅ Finished scanning all ${isVariant ? 'variants' : 'products'}.`);
        break;
      }

      cursor = scanResult.nextCursor;
    }

    printSummary(totalResourcesScanned, deletedCount, deletedMetafields, isVariant);

  } catch (error) {
    handleError(error, verbose);
    process.exit(1);
  }
}