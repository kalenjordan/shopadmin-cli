export const GET_PRODUCTS_WITH_UNSTRUCTURED_METAFIELDS: string = `
  query GetProductsWithUnstructuredMetafields($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          metafields(first: 250) {
            edges {
              node {
                id
                namespace
                key
                value
                type
                definition {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_VARIANTS_WITH_UNSTRUCTURED_METAFIELDS: string = `
  query GetVariantsWithUnstructuredMetafields($cursor: String) {
    productVariants(first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          sku
          product {
            title
            handle
          }
          metafields(first: 250) {
            edges {
              node {
                id
                namespace
                key
                value
                type
                definition {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const CREATE_METAFIELD_DEFINITION: string = `
  mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
        name
        namespace
        key
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const DELETE_METAFIELD_DEFINITION: string = `
  mutation DeleteMetafieldDefinition($id: ID!, $deleteAllAssociatedMetafields: Boolean!) {
    metafieldDefinitionDelete(
      id: $id,
      deleteAllAssociatedMetafields: $deleteAllAssociatedMetafields
    ) {
      deletedDefinitionId
      userErrors {
        field
        message
      }
    }
  }
`;

export const GET_METAFIELD_DEFINITIONS: string = `
  query GetMetafieldDefinitions($namespace: String!, $key: String!, $ownerType: MetafieldOwnerType!) {
    metafieldDefinitions(
      first: 1,
      namespace: $namespace,
      key: $key,
      ownerType: $ownerType
    ) {
      edges {
        node {
          id
          namespace
          key
          name
        }
      }
    }
  }
`;

// Legacy interfaces - consider migrating to types/graphql.ts
export interface UnstructuredMetafield {
  id: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
}