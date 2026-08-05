import type { PriceTier, Product } from "@prisma/client";
import { badInput } from "./auth.js";
import type { Mode } from "./constants.js";

/* THE source of truth for pricing. The frontend may preview prices, but every
   order line is recalculated here from the database — client-sent prices are
   never trusted (requirement #40). */

export type ProductWithTiers = Product & { priceTiers: PriceTier[] };

/** Wholesale unit price for a quantity, resolved from the product's tiers. */
export const tierUnitPrice = (tiers: PriceTier[], quantity: number): number => {
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  const tier = sorted.find(
    (t) => quantity >= t.minQty && (t.maxQty == null || quantity <= t.maxQty)
  );
  if (!tier) {
    // quantity above every bounded tier → cheapest ("N+") tier
    const open = sorted.find((t) => t.maxQty == null);
    if (open) return open.price;
    throw badInput("No price tier matches this quantity.");
  }
  return tier.price;
};

/** Unit price for a product in a mode — retail price or matching tier. */
export const unitPriceFor = (
  product: ProductWithTiers,
  quantity: number,
  mode: Mode
): number => {
  if (quantity < 1) throw badInput("Quantity must be at least 1.");

  if (mode === "WHOLESALE") {
    if (!product.availableWholesale)
      throw badInput(`"${product.name}" is not available for wholesale.`);
    if (quantity < product.minOrder)
      throw badInput(
        `"${product.name}" has a minimum order of ${product.minOrder} pcs.`
      );
    if (product.priceTiers.length === 0)
      throw badInput(`"${product.name}" has no wholesale pricing.`);
    return tierUnitPrice(product.priceTiers, quantity);
  }

  if (!product.availableRetail)
    throw badInput(`"${product.name}" is not available for retail.`);
  return product.retailPrice;
};

/** Validated line total; also enforces stock. */
export const lineTotal = (
  product: ProductWithTiers,
  quantity: number,
  mode: Mode
): { unitPrice: number; total: number } => {
  if (product.stock < quantity)
    throw badInput(
      `Only ${product.stock} pcs of "${product.name}" are in stock.`
    );
  const unitPrice = unitPriceFor(product, quantity, mode);
  return { unitPrice, total: round2(unitPrice * quantity) };
};

export const round2 = (n: number) => Math.round(n * 100) / 100;
