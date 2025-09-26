import chalk from 'chalk';

// Generate a consistent color for a shop name based on its hash
export function getShopColor(shopName: string): chalk.Chalk {
  // Calculate a hash from the shop name
  let hash = 0;
  for (let i = 0; i < shopName.length; i++) {
    const char = shopName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use absolute value to ensure positive number
  hash = Math.abs(hash);

  // Define a palette of colors that work well in terminals
  const colors = [
    chalk.cyan,
    chalk.green,
    chalk.yellow,
    chalk.blue,
    chalk.magenta,
    chalk.redBright,
    chalk.greenBright,
    chalk.yellowBright,
    chalk.blueBright,
    chalk.magentaBright,
    chalk.cyanBright,
  ];

  // Select a color based on the hash
  const colorIndex = hash % colors.length;
  return colors[colorIndex];
}

// Format a shop name with its unique color
export function formatShopName(shopName: string): string {
  const color = getShopColor(shopName);
  return color.bold(shopName);
}

// Format shop name with additional info (like URL)
export function formatShopInfo(shopName: string, url?: string): string {
  const coloredName = formatShopName(shopName);
  if (url) {
    return `${coloredName} ${chalk.gray(`(${url})`)}`;
  }
  return coloredName;
}