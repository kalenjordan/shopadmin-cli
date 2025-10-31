---
name: m-implement-customer-fetch
branch: feature/m-implement-customer-fetch
status: pending
created: 2025-10-31
---

# Implement Customer Fetch Command

## Problem/Goal
Add a customer fetch command to the Shopify admin CLI that allows users to retrieve customer information. The command should support flexible customer identification (GID, numeric ID, or email) and default to fetching the most recently updated customer when no identifier is provided.

## Success Criteria
- [ ] CLI command `npx tsx cli.ts customer fetch` fetches the most recently updated customer by default (no arguments)
- [ ] Command accepts customer identifier in three formats: GID (`gid://shopify/Customer/123`), numeric ID (`123`), or email address (`customer@example.com`)
- [ ] Command integrates with existing shop configuration (uses stored shop credentials)
- [ ] Output includes key customer information (name, email, order count, etc.) in readable format
- [ ] Error handling for invalid customer identifiers and API failures
- [ ] GraphQL queries properly fetch customer data from Shopify Admin API (both for specific customer and most recently updated)
- [ ] Command follows existing CLI patterns (similar structure to product/catalog commands)

## Context Manifest

### How This CLI Application Works: Command Pattern & Data Flow

This Shopify Admin CLI follows a consistent, modular architecture that separates concerns across configuration management, GraphQL API interaction, command execution, and output formatting. Understanding the complete flow from command invocation to API response will be critical for implementing the customer fetch command correctly.

#### Command Registration and Execution Flow

When a user runs `npx tsx cli.ts customer fetch [options]`, the following sequence occurs:

1. **Entry Point (cli.ts)**: The main CLI file uses Commander.js to define command hierarchies. Commands are organized into parent groups (shop, product, customer, order, catalog, metafield) with subcommands beneath them. Each subcommand is registered with:
   - A description
   - Options (using `.option()` for flags like `-s, --shop`, `-v, --verbose`, `-l, --limit`)
   - An async action handler that dynamically imports the command implementation

2. **Shop Selection (shopify-client.ts:selectShop)**: Before any command executes, the CLI must determine which Shopify store to operate on. This happens through `selectShop(options.shop)`, which follows this priority order:
   - If `--shop <name>` flag is provided, use that shop (validates it exists in config)
   - Else if a local `.shopadmin.config.ts` file exists with a `defaultShop` property, use that
   - Else if only one shop is configured globally, use it automatically
   - Else prompt the user to select from available shops using inquirer

3. **Command Execution**: Once the shop is selected, the command handler is invoked with options including the resolved Shop object. The handler lives in `/Users/kalen/src/tries/2025-09-26-shopadmin/src/commands/[command-name].ts`.

#### Shop Configuration Architecture

Shop credentials are stored in a TypeScript config file at `~/shopadmin.config.ts` (user's home directory). The structure is:

```typescript
export interface ShopsConfig {
  shops: Shop[];
  apiVersion?: string; // Required for API calls (e.g., "2025-10")
}

export interface Shop {
  name: string;           // User-friendly identifier
  url: string;            // https://storename.myshopify.com
  accessToken: string;    // Admin API access token
  addedAt: string;        // ISO timestamp
}
```

The `storage.ts` module handles loading/saving this config file. Critical functions:
- `loadShops()`: Reads and parses the TypeScript config file using require()
- `getShop(name)`: Retrieves a specific shop by name
- `listShops()`: Returns all configured shops

For local project-specific defaults, a `.shopadmin.config.ts` file in the current directory can specify `defaultShop: "shop-name"`.

#### GraphQL Client Creation and Error Handling

The `createShopifyClient(shop)` function (in `shopify-client.ts`) wraps the `@shopify/admin-api-client` package with enhanced error handling:

1. **Client Initialization**: Creates a client using the shop's URL (domain extracted), access token, and API version from global config
2. **Request Wrapper**: The returned client's `request` method is wrapped to intercept and enhance GraphQL errors
3. **Access Denied Detection**: If GraphQL errors contain `extensions.code === 'ACCESS_DENIED'`, it throws a user-friendly error message explaining the token lacks permissions and links to documentation
4. **Response Structure**: All responses follow this shape:
   ```typescript
   interface GraphQLResponse<T> {
     data: T;
     errors?: {
       graphQLErrors?: GraphQLError[];
     };
   }
   ```

The client is used like: `await client.request(QUERY_STRING, { variables: {...} })`

#### GraphQL Query Organization Pattern

All GraphQL queries and mutations are stored in `/Users/kalen/src/tries/2025-09-26-shopadmin/src/graphql/[resource].ts` files. They are exported as template strings with descriptive constant names:

For customers, the file is `/Users/kalen/src/tries/2025-09-26-shopadmin/src/graphql/customers.ts` which currently contains:
- `GET_CUSTOMERS_WITH_ORDER_COUNT`: Pagination query for listing customers
- `GET_CUSTOMER_ORDERS`: Fetches orders for a specific customer by ID

For products (as a reference pattern):
- `GET_PRODUCT_BY_HANDLE`: Query by handle (string identifier)
- `GET_PRODUCT_BY_ID`: Query by GID (GraphQL ID like `gid://shopify/Product/123`)
- `LIST_PRODUCTS`: Paginated list with sorting

The pattern shows that resources typically need:
1. A "get by ID" query
2. A "get by handle/email/other identifier" query (when applicable)
3. A "list with sorting" query for fetching the most recent

#### Customer Data Structure in Shopify GraphQL

From the existing `customers.ts` GraphQL file and `customer-download.ts` command, we can see the customer data model:

**Customer Fields Available:**
- `id` (GID format: `gid://shopify/Customer/123456`)
- `email` (primary identifier, can be null for draft customers)
- `firstName`, `lastName` (nullable strings)
- `displayName` (computed full name or email)
- `phone` (nullable)
- `numberOfOrders` (integer count)
- `defaultAddress` (nested object with address1, address2, city, province, country, zip, phone)
- `createdAt`, `updatedAt` (ISO timestamp strings)
- `state` (DISABLED, INVITED, ENABLED, DECLINED)
- `tags` (array of strings)
- `note` (nullable string)
- `orders` (connection to Order objects, requires pagination)

**Customer Query Patterns:**
The Shopify Admin API provides these main ways to fetch customers:
1. `customer(id: ID!)` - Get a single customer by GID
2. `customers(first: Int!, query: String, sortKey: CustomerSortKeys, reverse: Boolean)` - Search/list customers
   - The `query` parameter supports search syntax like `email:customer@example.com`
   - Sort keys include: ID, NAME, LOCATION, ORDERS_COUNT, LAST_ORDER_DATE, TOTAL_SPENT, UPDATED_AT, etc.

**Critical Pattern for Most Recent Customer:**
To fetch the most recently updated customer (default behavior when no identifier is provided), use:
```graphql
customers(first: 1, sortKey: UPDATED_AT, reverse: true) {
  edges { node { ...customerFields } }
}
```

#### Command Implementation Pattern: product-get.ts Analysis

The `product-get.ts` command demonstrates the canonical pattern for "fetch a resource by flexible identifier":

1. **Options Interface**: Defines a strongly-typed interface extending from base options:
   ```typescript
   interface CommandOptions {
     shop: Shop;           // Always included from selectShop()
     handleOrId: string;   // The identifier argument
     verbose?: boolean;    // Standard flag for debug output
   }
   ```

2. **Identifier Detection**: The command checks if the input is a GID (starts with `gid://`) or a handle:
   ```typescript
   const isId = handleOrId.startsWith('gid://');
   ```

3. **Conditional Query Selection**: Based on identifier type, use different GraphQL queries:
   - If GID: `GET_PRODUCT_BY_ID` with variable `{ id: handleOrId }`
   - If handle: `GET_PRODUCT_BY_HANDLE` with variable `{ handle: handleOrId }`

4. **Response Extraction**: The response data path differs by query:
   - By ID: `response.data?.product`
   - By handle: `response.data?.productByHandle`

5. **Not Found Handling**: If product is null, log error and exit with code 1

6. **Data Transformation**: The command includes a `transformProductData()` function that flattens the GraphQL edges/nodes structure into a cleaner JSON format for output

7. **Output Format**: The transformed data is output as `JSON.stringify(transformedProduct, null, 2)` to stdout (this is the standard - commands return JSON for piping/scripting)

#### Command Implementation Pattern: product-list.ts Analysis

The `product-list.ts` command shows the pattern for listing resources with table output:

1. **Limit Validation**: Parses the `--limit` option and validates it's a positive integer
2. **GraphQL Variables**: Passes structured variables for pagination and sorting:
   ```typescript
   variables: { first, sortKey: 'UPDATED_AT', reverse: true }
   ```
3. **Empty Response Handling**: Checks if edges array is empty and shows friendly message
4. **Edge Unwrapping**: Maps over edges to extract nodes: `edges.map((edge: any) => edge.node)`
5. **Table Display**: Uses `cli-table3` package to create formatted terminal tables with:
   - Header row with `chalk.bold()` styling
   - Column width specifications for consistent layout
   - Status color coding (green for ACTIVE, yellow for others)
   - Date formatting helper for readable timestamps

6. **Verbose Mode**: When `--verbose` flag is present, logs the full GraphQL response as JSON before displaying the table

#### Error Handling Patterns

The codebase uses several error handling strategies:

1. **Try-Catch with Process Exit**: All command handlers wrap execution in try-catch and call `process.exit(1)` on errors
2. **Error Message Extraction**: `const errorMessage = error instanceof Error ? error.message : String(error)`
3. **Verbose Stack Traces**: When verbose flag is true, output `error.stack` in gray chalk
4. **Consistent Error Format**: Use `chalk.red('Error [action]:')` followed by the message
5. **GraphQL Error Parsing**: The `utils/errors.ts` module has `parseGraphQLErrors()` which detects:
   - Authentication errors (invalid/expired tokens)
   - Rate limit errors
   - Generic GraphQL errors
   It provides user-friendly messages and actionable suggestions

6. **Access Denied Auto-Detection**: The shopify-client wrapper automatically catches ACCESS_DENIED errors and throws enhanced messages

#### Output Formatting and User Experience

The codebase follows these UX conventions:

1. **Color Coding**: Uses chalk for semantic colors:
   - Shop names: Hashed color (consistent per shop name via `formatShopName()`)
   - Headings/labels: cyan for section headers, gray for field labels
   - Success: green with checkmarks (✓)
   - Warnings: yellow
   - Errors: red with X or ❌ emoji
   - Status: green for active/enabled, yellow for inactive/pending

2. **Progress Indicators**: Commands show progress for multi-step operations:
   - Initial: "Fetching [resource] from [ShopName]..."
   - During: Gray text for batch numbers or progress
   - Complete: Green checkmark with summary

3. **Separators**: From constants.ts:
   - `LINE_SEPARATORS.THIN`: 60 dashes for section breaks
   - `LINE_SEPARATORS.THICK`: 80 equal signs for major divisions
   - `LINE_SEPARATORS.SECTION`: 80 dashes for sections

4. **Date Formatting**: Helper function formats ISO dates to readable format:
   ```typescript
   new Date(dateString).toLocaleDateString('en-US', {
     year: 'numeric', month: 'short', day: 'numeric'
   })
   ```

5. **Verbose Output**: When `--verbose` flag is present:
   - Log the GraphQL query being sent (optional)
   - Log full GraphQL response as JSON.stringify(response, null, 2)
   - Show error stack traces
   - Display progress for each step

### For Customer Fetch Implementation: What Needs to Connect

Based on the patterns above and the task requirements, here's how the new customer fetch command must integrate:

#### CLI Registration (cli.ts)

The customer command group already exists (lines 277-293). We need to add a new `.command('fetch')` subcommand to it, similar to how product has `.command('get')`. The registration should:

1. Accept an optional positional argument for customer identifier: `.command('fetch [identifier]')`
2. Include standard options: `--shop`, `--verbose`
3. Use `async (identifier, options)` as the action handler signature (note: positional args come before options object)
4. Call `selectShop(options.shop)` to resolve the shop
5. Dynamically import: `const { fetchCustomer } = await import('./src/commands/customer-fetch');`
6. Invoke: `await fetchCustomer({ ...options, identifier, shop });`

#### GraphQL Queries (src/graphql/customers.ts)

We need to add two new query exports to the existing customers.ts file:

1. **GET_CUSTOMER_BY_ID**: Query that fetches a customer by GID
   ```graphql
   query getCustomerById($id: ID!) {
     customer(id: $id) {
       id
       email
       firstName
       lastName
       displayName
       phone
       numberOfOrders
       createdAt
       updatedAt
       state
       tags
       note
       defaultAddress {
         address1
         address2
         city
         province
         country
         zip
         phone
       }
     }
   }
   ```

2. **GET_CUSTOMER_BY_EMAIL**: Use customers connection with query parameter
   ```graphql
   query getCustomerByEmail($email: String!) {
     customers(first: 1, query: $email) {
       edges {
         node {
           [same fields as above]
         }
       }
     }
   }
   ```
   Note: The query parameter would be formatted as `email:${email}` when calling

3. **GET_MOST_RECENT_CUSTOMER**: Fetch the most recently updated customer
   ```graphql
   query getMostRecentCustomer {
     customers(first: 1, sortKey: UPDATED_AT, reverse: true) {
       edges {
         node {
           [same fields as above]
         }
       }
     }
   }
   ```

#### Identifier Type Detection Logic

The command must handle three input formats:

1. **GID Detection**: `identifier.startsWith('gid://shopify/Customer/')`
2. **Email Detection**: `identifier.includes('@')`
3. **Numeric ID Detection**: `/^\d+$/.test(identifier)` - convert to GID format: `gid://shopify/Customer/${identifier}`
4. **No Identifier**: When identifier is undefined/empty, fetch most recent customer

This is more complex than product-get which only had GID vs handle. The decision tree:
```typescript
if (!identifier) {
  // Use GET_MOST_RECENT_CUSTOMER
} else if (identifier.startsWith('gid://')) {
  // Use GET_CUSTOMER_BY_ID with id: identifier
} else if (/^\d+$/.test(identifier)) {
  // Use GET_CUSTOMER_BY_ID with id: `gid://shopify/Customer/${identifier}`
} else if (identifier.includes('@')) {
  // Use GET_CUSTOMER_BY_EMAIL with query formatted as `email:${identifier}`
} else {
  // Error: invalid identifier format
}
```

#### Command Implementation (src/commands/customer-fetch.ts)

Create a new file following the established pattern:

1. **Imports**: Same as other commands (createShopifyClient, formatShopName, Shop, chalk, graphql queries)
2. **Options Interface**:
   ```typescript
   interface CommandOptions {
     shop: Shop;
     identifier?: string;  // Optional since default is "most recent"
     verbose?: boolean;
   }
   ```
3. **Transform Function**: Create `transformCustomerData(customer)` to flatten edges/nodes and format for clean JSON output
4. **Main Function**: `export async function fetchCustomer(options: CommandOptions)`

**Special Considerations:**
- When using the customers connection (email search or most recent), we must extract from edges: `response.data?.customers?.edges?.[0]?.node`
- Must handle "not found" for email searches (empty edges array)
- The GID format is `gid://shopify/Customer/[numeric-id]` - numeric ID is the last segment after splitting on '/'

#### Data Transformation Pattern

Looking at product-get's transformation, we should create a similar function for customers:

```typescript
function transformCustomerData(customer: any) {
  return {
    id: customer.id,
    numericId: customer.id.split('/').pop(),  // Extract just the number
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    displayName: customer.displayName,
    phone: customer.phone,
    numberOfOrders: customer.numberOfOrders,
    state: customer.state,
    tags: customer.tags,
    note: customer.note,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    defaultAddress: customer.defaultAddress
  };
}
```

This flattens the GraphQL response into a cleaner JSON structure, similar to how product-get transforms media/variants from edges to arrays.

#### Output Format Decision

Based on the existing patterns:
- **product-get**: Outputs JSON (for scripting/piping)
- **product-list**: Outputs a formatted table (for human reading)
- **catalog-list**: Outputs a formatted table
- **shop-info**: Outputs formatted sections with colored labels

For "customer fetch", since it's fetching a single customer (similar to product-get), we should output JSON to stdout. This allows for piping the output to other commands or processing with jq.

If we wanted to add a table-based display, we could add a `--format` option (json vs table), but that's not in the success criteria, so JSON output is the way to go.

#### Verbose Mode Behavior

When `--verbose` flag is used:
1. Log which shop is being used (already done by selectShop)
2. Log which identifier type was detected and which query will be used
3. Log the GraphQL response (full JSON)
4. Log the transformation step
5. Show error stack traces if errors occur

#### Error Scenarios to Handle

1. **No identifier, no customers in shop**: Empty edges array when fetching most recent
2. **Invalid email**: No matches found in customers search
3. **Invalid numeric ID**: Customer not found (returns null)
4. **Invalid GID format**: Customer not found
5. **Malformed identifier**: Doesn't match any expected format
6. **Access denied**: User's token doesn't have customer read permissions (handled by shopify-client wrapper)
7. **Network errors**: Timeout, connection issues (caught by try-catch)

Each should show a user-friendly error message and exit with code 1.

### Technical Reference Details

#### File Locations for Implementation

- **CLI Command Registration**: `/Users/kalen/src/tries/2025-09-26-shopadmin/cli.ts` (lines 277-293, add after customer.command('download'))
- **Command Implementation**: `/Users/kalen/src/tries/2025-09-26-shopadmin/src/commands/customer-fetch.ts` (new file)
- **GraphQL Queries**: `/Users/kalen/src/tries/2025-09-26-shopadmin/src/graphql/customers.ts` (add three new query exports)

#### GraphQL Query Structure Template

```typescript
export const GET_CUSTOMER_BY_ID = `
  query getCustomerById($id: ID!) {
    customer(id: $id) {
      id
      email
      firstName
      lastName
      displayName
      phone
      numberOfOrders
      createdAt
      updatedAt
      state
      tags
      note
      defaultAddress {
        address1
        address2
        city
        province
        country
        zip
        phone
      }
    }
  }
`;
```

#### Command Function Signature

```typescript
interface CommandOptions {
  shop: Shop;
  identifier?: string;
  verbose?: boolean;
}

export async function fetchCustomer(options: CommandOptions): Promise<void>
```

#### CLI Registration Pattern

```typescript
customer
  .command('fetch [identifier]')
  .description('Fetch customer by ID, email, or get most recently updated')
  .option('-s, --shop <name>', 'Shop name to use (overrides default)')
  .option('-v, --verbose', 'Show detailed progress and GraphQL responses')
  .action(async (identifier, options) => {
    const shop = await selectShop(options.shop);
    const { fetchCustomer } = await import('./src/commands/customer-fetch');
    await fetchCustomer({ ...options, identifier, shop });
  });
```

#### Expected GraphQL Response Shapes

**For customer by ID:**
```typescript
{
  data: {
    customer: {
      id: "gid://shopify/Customer/123",
      email: "customer@example.com",
      // ... other fields
    } | null
  }
}
```

**For customers connection (email or most recent):**
```typescript
{
  data: {
    customers: {
      edges: [
        {
          node: {
            id: "gid://shopify/Customer/123",
            // ... other fields
          }
        }
      ]
    }
  }
}
```

#### Identifier Processing Logic

```typescript
// Determine which query to use and what variables to pass
let query: string;
let variables: Record<string, any>;
let dataPath: string; // Path to extract customer from response

if (!identifier) {
  query = GET_MOST_RECENT_CUSTOMER;
  variables = {};
  dataPath = 'customers.edges[0].node';
} else if (identifier.startsWith('gid://')) {
  query = GET_CUSTOMER_BY_ID;
  variables = { id: identifier };
  dataPath = 'customer';
} else if (/^\d+$/.test(identifier)) {
  query = GET_CUSTOMER_BY_ID;
  variables = { id: `gid://shopify/Customer/${identifier}` };
  dataPath = 'customer';
} else if (identifier.includes('@')) {
  query = GET_CUSTOMER_BY_EMAIL;
  variables = { query: `email:${identifier}` };
  dataPath = 'customers.edges[0].node';
} else {
  throw new Error('Invalid identifier format. Use: GID, numeric ID, or email address');
}
```

#### Dependencies Already Available

From package.json, these are already installed and can be imported:
- `chalk` (v5.6.2): For colored output
- `@shopify/admin-api-client` (v1.1.1): GraphQL client (wrapped by createShopifyClient)
- `commander` (v14.0.1): CLI framework (already used in cli.ts)

No new dependencies needed for this feature.

#### Standard Error Handling Pattern to Follow

```typescript
try {
  // Command logic
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(chalk.red('Error fetching customer:'), errorMessage);
  if (verbose && error instanceof Error && error.stack) {
    console.error(chalk.gray(error.stack));
  }
  process.exit(1);
}
```

#### Testing the Command

Once implemented, test with these scenarios:

1. **No arguments**: `npx tsx cli.ts customer fetch` (should get most recent customer)
2. **Numeric ID**: `npx tsx cli.ts customer fetch 123`
3. **GID**: `npx tsx cli.ts customer fetch gid://shopify/Customer/123`
4. **Email**: `npx tsx cli.ts customer fetch customer@example.com`
5. **With verbose**: `npx tsx cli.ts customer fetch --verbose`
6. **With shop override**: `npx tsx cli.ts customer fetch --shop "StoreName"`
7. **Invalid ID**: Should show error (not found)
8. **Invalid format**: Should show format error

#### Key Architectural Decisions Already Made

1. **No table output needed**: Following product-get pattern (JSON output only)
2. **Exit code 1 on errors**: All commands follow this pattern
3. **Verbose flag optional**: Standard flag, logs GraphQL responses when present
4. **Dynamic imports**: Commands are lazy-loaded to improve startup time
5. **Shop selection at CLI level**: Done before command execution, passed as option
6. **TypeScript config files**: For storing shop credentials (not JSON)
7. **Flatten edges/nodes**: Transform function makes output cleaner for end users

## User Notes
<!-- Any specific notes or requirements from the developer -->

## Work Log
<!-- Updated as work progresses -->
- [YYYY-MM-DD] Started task, initial research
