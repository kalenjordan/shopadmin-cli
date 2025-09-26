export const GET_PRODUCTS_WITH_UNSTRUCTURED_METAFIELDS = `
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

export const CREATE_METAFIELD_DEFINITION = `
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

export const DELETE_METAFIELD_DEFINITION = `
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

export const GET_METAFIELD_DEFINITIONS = `
  query GetMetafieldDefinitions($namespace: String!, $key: String!) {
    metafieldDefinitions(
      first: 1,
      namespace: $namespace,
      key: $key,
      ownerType: PRODUCT
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

export interface UnstructuredMetafield {
  id: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface ProductWithMetafields {
  id: string;
  title: string;
  handle: string;
  unstructuredMetafields: UnstructuredMetafield[];
}