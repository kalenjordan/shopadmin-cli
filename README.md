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

#### Add a store
```bash
npx tsx cli.ts add -n "Store Name" -u "https://store.myshopify.com" -t "admin-api-token"
```

#### List all stores
```bash
npx tsx cli.ts list
```

#### Remove a store
```bash
npx tsx cli.ts remove -n "Store Name"
```

#### Set default shop
```bash
npx tsx cli.ts default-shop -n "Store Name"
```

### Metafield Operations

#### Delete unstructured metafields
```bash
npx tsx cli.ts delete-unstructured-metafields -n "Store Name"
```

With force option (no prompt):
```bash
npx tsx cli.ts delete-unstructured-metafields -n "Store Name" --force
```

## Configuration

The CLI stores configuration in `config.ts` with your shop credentials and settings.

## Help

For more information on any command:
```bash
npx tsx cli.ts --help
```