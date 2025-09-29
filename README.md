# Shopify Admin CLI

A command-line interface for managing Shopify stores and their metafields.

## Installation

```bash
npm install
```

## Usage

Run commands using tsx:

```bash
npx tsx cli.ts [command] [options]
```

## Commands

### Store Management

All store management commands are under the `shop` command:

#### Add a store
```bash
npx tsx cli.ts shop add -s "your-store" -t "admin-api-token" [-n "Store Name"]
```

#### List all stores
```bash
npx tsx cli.ts shop list
```

#### Remove a store
```bash
npx tsx cli.ts shop remove -n "Store Name"
```

#### Set default shop for current directory
```bash
npx tsx cli.ts shop default
```

#### Get shop information
```bash
npx tsx cli.ts shop info [-s "Store Name"]
```

### Metafield Operations

#### Delete unstructured metafields (products or variants)
Delete unstructured product metafields:
```bash
npx tsx cli.ts metafield delete-unstructured [-s "Store Name"]
```

Delete unstructured variant metafields:
```bash
npx tsx cli.ts metafield delete-unstructured --variants [-s "Store Name"]
```

With force option (no prompt):
```bash
npx tsx cli.ts metafield delete-unstructured --force [-s "Store Name"]
npx tsx cli.ts metafield delete-unstructured --variants --force [-s "Store Name"]
```

### Product Operations

#### Delete unstructured product metafields (legacy)
```bash
npx tsx cli.ts product metafields delete-unstructured [-s "Store Name"]
```

## Configuration

The CLI stores configuration in `config.ts` with your shop credentials and settings.

## Help

For more information on any command:
```bash
npx tsx cli.ts --help
```