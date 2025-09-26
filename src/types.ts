export interface Shop {
  name: string;
  url: string;
  accessToken: string;
  addedAt: string;
}

export interface ShopsConfig {
  shops: Shop[];
}