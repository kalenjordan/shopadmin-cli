export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface MetafieldDefinition {
  id: string;
}

export interface Metafield {
  id: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
  definition: MetafieldDefinition | null;
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  metafields: {
    edges: Array<{
      node: Metafield;
    }>;
  };
}

export interface ProductVariant {
  id: string;
  title: string | null;
  sku: string | null;
  product: {
    title: string;
    handle: string;
  };
  metafields: {
    edges: Array<{
      node: Metafield;
    }>;
  };
}

export interface ProductsResponse {
  data?: {
    products: {
      pageInfo: PageInfo;
      edges: Array<{
        node: Product;
      }>;
    };
  };
  errors?: GraphQLError[];
}

export interface VariantsResponse {
  data?: {
    productVariants: {
      pageInfo: PageInfo;
      edges: Array<{
        node: ProductVariant;
      }>;
    };
  };
  errors?: GraphQLError[];
}

export interface MetafieldDefinitionNode {
  id: string;
  namespace: string;
  key: string;
  name: string;
}

export interface MetafieldDefinitionsResponse {
  data: {
    metafieldDefinitions: {
      edges: Array<{
        node: MetafieldDefinitionNode;
      }>;
    };
  };
}

export interface CreateMetafieldDefinitionResponse {
  data: {
    metafieldDefinitionCreate: {
      createdDefinition: {
        id: string;
        name: string;
        namespace: string;
        key: string;
      };
      userErrors: UserError[];
    };
  };
}

export interface DeleteMetafieldDefinitionResponse {
  data: {
    metafieldDefinitionDelete: {
      deletedDefinitionId: string;
      userErrors: UserError[];
    };
  };
}

export interface UserError {
  field?: string[];
  message: string;
}

export interface GraphQLError {
  message: string;
  extensions?: {
    code?: string;
  };
}

export type ResourceType = 'product' | 'variant';
export type OwnerType = 'PRODUCT' | 'PRODUCTVARIANT';