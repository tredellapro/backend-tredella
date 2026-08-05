/* Seed: demo marketplace data. Product images point at the Next.js app's
   /public paths so the frontend renders them directly. */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/* ---------------- catalog (mirrors the frontend demo catalog) ---------------- */

type Item = {
  name: string;
  image: number;
  category: string;
  subcategory: string;
  basePrice: number;
  rating: number;
  reviews: number;
  sold: number;
  minOrder: number;
};

const CATEGORIES = [
  {
    slug: "electronics",
    name: "Electronics",
    icon: "electronics",
    subs: ["Mobiles & Tablets", "Audio & Video", "Cameras & Drones", "Appliances"],
  },
  {
    slug: "fashion",
    name: "Fashion",
    icon: "fashion",
    subs: ["Clothes", "Accessories", "Shoes"],
  },
];

const catalog: Item[] = [
  { name: "Vivo V21 Smartphone", image: 9, category: "electronics", subcategory: "Mobiles & Tablets", basePrice: 899, rating: 4.4, reviews: 182, sold: 7400, minOrder: 10 },
  { name: "Nokia Android One", image: 10, category: "electronics", subcategory: "Mobiles & Tablets", basePrice: 549, rating: 4.2, reviews: 96, sold: 5100, minOrder: 10 },
  { name: "HTC Desire 2018", image: 11, category: "electronics", subcategory: "Mobiles & Tablets", basePrice: 620, rating: 4.1, reviews: 74, sold: 3900, minOrder: 10 },
  { name: "iPhone 7 Classic", image: 33, category: "electronics", subcategory: "Mobiles & Tablets", basePrice: 1150, rating: 4.6, reviews: 411, sold: 12800, minOrder: 5 },
  { name: "Smart Watch Series Pro", image: 4, category: "electronics", subcategory: "Mobiles & Tablets", basePrice: 475, rating: 4.6, reviews: 389, sold: 15700, minOrder: 10 },
  { name: "Xiaomi Mi Band 2", image: 34, category: "electronics", subcategory: "Mobiles & Tablets", basePrice: 145, rating: 4.3, reviews: 528, sold: 24500, minOrder: 20 },
  { name: "Rangs Smartphone 2020", image: 49, category: "electronics", subcategory: "Mobiles & Tablets", basePrice: 460, rating: 4.0, reviews: 63, sold: 2800, minOrder: 10 },
  { name: "Symphony Z Lite", image: 50, category: "electronics", subcategory: "Mobiles & Tablets", basePrice: 380, rating: 4.1, reviews: 87, sold: 4100, minOrder: 10 },
  { name: "Beats W3 Wireless Headphones", image: 15, category: "electronics", subcategory: "Audio & Video", basePrice: 720, rating: 4.7, reviews: 344, sold: 9200, minOrder: 10 },
  { name: "Beats Wireless Earphones", image: 16, category: "electronics", subcategory: "Audio & Video", basePrice: 410, rating: 4.5, reviews: 218, sold: 11300, minOrder: 15 },
  { name: "Smart Voice Assistant Speaker", image: 1, category: "electronics", subcategory: "Audio & Video", basePrice: 147, rating: 4.5, reviews: 214, sold: 12400, minOrder: 10 },
  { name: "Sony 4K Smart TV 55\"", image: 14, category: "electronics", subcategory: "Audio & Video", basePrice: 2350, rating: 4.8, reviews: 167, sold: 2100, minOrder: 2 },
  { name: "Gaming Console Controller Bundle", image: 2, category: "electronics", subcategory: "Audio & Video", basePrice: 915, rating: 4.8, reviews: 452, sold: 5200, minOrder: 5 },
  { name: "LG Home Entertainment System", image: 7, category: "electronics", subcategory: "Audio & Video", basePrice: 1100, rating: 4.5, reviews: 97, sold: 3100, minOrder: 4 },
  { name: "Apple Wired Earphones", image: 47, category: "electronics", subcategory: "Audio & Video", basePrice: 110, rating: 4.4, reviews: 391, sold: 18200, minOrder: 25 },
  { name: "Pink Wireless Earphones", image: 48, category: "electronics", subcategory: "Audio & Video", basePrice: 175, rating: 4.2, reviews: 146, sold: 7600, minOrder: 20 },
  { name: "Lumix DSLR Camera", image: 12, category: "electronics", subcategory: "Cameras & Drones", basePrice: 2850, rating: 4.7, reviews: 88, sold: 1400, minOrder: 2 },
  { name: "Sony Alpha A9 Mirrorless", image: 13, category: "electronics", subcategory: "Cameras & Drones", basePrice: 5400, rating: 4.9, reviews: 61, sold: 800, minOrder: 2 },
  { name: "Tello Camera Drone", image: 17, category: "electronics", subcategory: "Cameras & Drones", basePrice: 690, rating: 4.4, reviews: 132, sold: 4300, minOrder: 5 },
  { name: "Professional Studio Camera", image: 35, category: "electronics", subcategory: "Cameras & Drones", basePrice: 3900, rating: 4.6, reviews: 45, sold: 600, minOrder: 2 },
  { name: "Atech 1080p Action Cam", image: 36, category: "electronics", subcategory: "Cameras & Drones", basePrice: 380, rating: 4.2, reviews: 157, sold: 6800, minOrder: 10 },
  { name: "Tello Super Drone Pro", image: 37, category: "electronics", subcategory: "Cameras & Drones", basePrice: 1250, rating: 4.5, reviews: 93, sold: 2200, minOrder: 4 },
  { name: "Phase One Studio Camera", image: 43, category: "electronics", subcategory: "Cameras & Drones", basePrice: 7200, rating: 4.8, reviews: 34, sold: 350, minOrder: 1 },
  { name: "Explorer 4K Camera Drone", image: 44, category: "electronics", subcategory: "Cameras & Drones", basePrice: 1850, rating: 4.6, reviews: 118, sold: 1700, minOrder: 3 },
  { name: "Vision Blender 900W", image: 18, category: "electronics", subcategory: "Appliances", basePrice: 210, rating: 4.3, reviews: 176, sold: 8600, minOrder: 12 },
  { name: "Vision Microwave Oven 25L", image: 19, category: "electronics", subcategory: "Appliances", basePrice: 430, rating: 4.4, reviews: 121, sold: 4700, minOrder: 6 },
  { name: "Panasonic Rice Cooker", image: 20, category: "electronics", subcategory: "Appliances", basePrice: 265, rating: 4.5, reviews: 203, sold: 7100, minOrder: 10 },
  { name: "LG Front Load Washing Machine", image: 8, category: "electronics", subcategory: "Appliances", basePrice: 2015, rating: 4.9, reviews: 156, sold: 1900, minOrder: 2 },
  { name: "Sony CCTV Security Camera", image: 38, category: "electronics", subcategory: "Appliances", basePrice: 340, rating: 4.3, reviews: 89, sold: 5600, minOrder: 10 },
  { name: "Dual Band WiFi Router AC1200", image: 3, category: "electronics", subcategory: "Appliances", basePrice: 202, rating: 4.3, reviews: 128, sold: 8900, minOrder: 20 },
  { name: "Dune HD Media Player", image: 45, category: "electronics", subcategory: "Appliances", basePrice: 520, rating: 4.2, reviews: 58, sold: 1900, minOrder: 6 },
  { name: "Panasonic Fast Charger", image: 46, category: "electronics", subcategory: "Appliances", basePrice: 95, rating: 4.3, reviews: 244, sold: 13400, minOrder: 30 },
  { name: "Silver High Neck Sweater", image: 21, category: "fashion", subcategory: "Clothes", basePrice: 185, rating: 4.4, reviews: 143, sold: 9400, minOrder: 20 },
  { name: "Lands Winter Jacket", image: 22, category: "fashion", subcategory: "Clothes", basePrice: 420, rating: 4.6, reviews: 201, sold: 6300, minOrder: 12 },
  { name: "Striped Casual Shirt", image: 23, category: "fashion", subcategory: "Clothes", basePrice: 130, rating: 4.2, reviews: 167, sold: 11200, minOrder: 24 },
  { name: "Blue Slim Fit Trousers", image: 24, category: "fashion", subcategory: "Clothes", basePrice: 160, rating: 4.3, reviews: 118, sold: 8700, minOrder: 24 },
  { name: "Double Wool Overcoat", image: 25, category: "fashion", subcategory: "Clothes", basePrice: 560, rating: 4.7, reviews: 84, sold: 3100, minOrder: 8 },
  { name: "Green Ski Jacket", image: 26, category: "fashion", subcategory: "Clothes", basePrice: 480, rating: 4.5, reviews: 92, sold: 2800, minOrder: 10 },
  { name: "Pink Kids Wear Set", image: 51, category: "fashion", subcategory: "Clothes", basePrice: 140, rating: 4.4, reviews: 156, sold: 8100, minOrder: 24 },
  { name: "High Waisted Gabardine Pants", image: 52, category: "fashion", subcategory: "Clothes", basePrice: 175, rating: 4.3, reviews: 104, sold: 5400, minOrder: 20 },
  { name: "Ray-Ban Ocean Sunglasses", image: 27, category: "fashion", subcategory: "Accessories", basePrice: 390, rating: 4.6, reviews: 274, sold: 7800, minOrder: 12 },
  { name: "Fossil Watch — Brown Leather", image: 28, category: "fashion", subcategory: "Accessories", basePrice: 620, rating: 4.7, reviews: 189, sold: 4200, minOrder: 6 },
  { name: "Silver Snapback Cap", image: 29, category: "fashion", subcategory: "Accessories", basePrice: 75, rating: 4.1, reviews: 236, sold: 16800, minOrder: 30 },
  { name: "MVMT Watch — Matte Black", image: 30, category: "fashion", subcategory: "Accessories", basePrice: 540, rating: 4.5, reviews: 147, sold: 3600, minOrder: 6 },
  { name: "Sunglasses Collection Set", image: 31, category: "fashion", subcategory: "Accessories", basePrice: 260, rating: 4.3, reviews: 165, sold: 9100, minOrder: 15 },
  { name: "Skmei Sport Watch Black", image: 32, category: "fashion", subcategory: "Accessories", basePrice: 190, rating: 4.2, reviews: 132, sold: 6900, minOrder: 12 },
  { name: "Dragon Red Wrist Watch", image: 53, category: "fashion", subcategory: "Accessories", basePrice: 230, rating: 4.3, reviews: 98, sold: 4700, minOrder: 12 },
  { name: "Police Gray Eyeglasses", image: 54, category: "fashion", subcategory: "Accessories", basePrice: 310, rating: 4.5, reviews: 173, sold: 6200, minOrder: 10 },
  { name: "Nike Running Sneakers — Red", image: 5, category: "fashion", subcategory: "Shoes", basePrice: 330, rating: 4.7, reviews: 731, sold: 21000, minOrder: 12 },
  { name: "Adidas Classic Sneakers — White", image: 6, category: "fashion", subcategory: "Shoes", basePrice: 294, rating: 4.4, reviews: 264, sold: 9800, minOrder: 12 },
  { name: "Nike Air — White", image: 39, category: "fashion", subcategory: "Shoes", basePrice: 410, rating: 4.6, reviews: 318, sold: 8600, minOrder: 12 },
  { name: "Puma Sport — Red", image: 40, category: "fashion", subcategory: "Shoes", basePrice: 350, rating: 4.4, reviews: 176, sold: 5900, minOrder: 12 },
  { name: "Nike Pink Edition", image: 41, category: "fashion", subcategory: "Shoes", basePrice: 375, rating: 4.5, reviews: 208, sold: 7200, minOrder: 12 },
  { name: "Nike Silver Metallic", image: 42, category: "fashion", subcategory: "Shoes", basePrice: 395, rating: 4.6, reviews: 154, sold: 4800, minOrder: 12 },
  { name: "Flow White Sneakers", image: 55, category: "fashion", subcategory: "Shoes", basePrice: 285, rating: 4.3, reviews: 121, sold: 5100, minOrder: 12 },
  { name: "Nike Mint Edition", image: 56, category: "fashion", subcategory: "Shoes", basePrice: 365, rating: 4.5, reviews: 187, sold: 6400, minOrder: 12 },
];

/* ---------------- helpers ---------------- */

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const round = (n: number) => Math.round(n);

const BRANDS = ["Nike", "Adidas", "Puma", "Sony", "LG", "Apple", "Beats", "Panasonic", "Vision", "Xiaomi", "Tello", "Vivo", "Nokia", "HTC", "Fossil", "MVMT", "Ray-Ban", "Skmei", "Dune", "Netgear", "Symphony", "Rangs", "Police"];
const brandOf = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes("iphone")) return "Apple";
  return BRANDS.find((b) => lower.includes(b.toLowerCase())) ?? "Tredella";
};

const COLORS = ["Black", "White", "Silver", "Blue", "Red", "Gray"];
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

/* Requirement #6 example shape: 5 tiers → 1-10 / 11-20 / 21-50 / 51-100 / 100+ */
const tiersFor = (basePrice: number) => [
  { minQty: 1, maxQty: 10, price: round(basePrice * 0.85) },
  { minQty: 11, maxQty: 20, price: round(basePrice * 0.77) },
  { minQty: 21, maxQty: 50, price: round(basePrice * 0.7) },
  { minQty: 51, maxQty: 100, price: round(basePrice * 0.63) },
  { minQty: 101, maxQty: null, price: round(basePrice * 0.55) },
];

const attributesFor = (item: Item, i: number): { name: string; value: string }[] => {
  const attrs: { name: string; value: string }[] = [
    { name: "Brand", value: brandOf(item.name) },
    { name: "Country of Origin", value: pick(["UAE", "China", "Vietnam", "Turkey"], i) },
  ];
  switch (item.subcategory) {
    case "Mobiles & Tablets":
      attrs.push(
        { name: "RAM", value: pick(["4GB", "6GB", "8GB"], i) },
        { name: "Storage", value: pick(["64GB", "128GB", "256GB"], i) },
        { name: "Color", value: pick(COLORS, i) },
        { name: "Screen Size", value: pick(['6.1"', '6.5"', '6.7"'], i) }
      );
      break;
    case "Audio & Video":
    case "Appliances":
      attrs.push(
        { name: "Color", value: pick(COLORS, i) },
        { name: "Warranty", value: pick(["1 Year", "2 Years"], i) }
      );
      break;
    case "Cameras & Drones":
      attrs.push(
        { name: "Resolution", value: pick(["1080p", "4K", "6K"], i) },
        { name: "Color", value: pick(["Black", "Gray", "White"], i) }
      );
      break;
    case "Clothes":
      attrs.push(
        { name: "Size", value: pick(["S", "M", "L", "XL"], i) },
        { name: "Material", value: pick(["Cotton", "Wool", "Polyester", "Denim"], i) },
        { name: "Color", value: pick(COLORS, i) },
        { name: "Gender", value: pick(["Men", "Women", "Unisex"], i) }
      );
      break;
    case "Shoes":
      attrs.push(
        { name: "Size", value: pick(["40", "41", "42", "43", "44"], i) },
        { name: "Color", value: pick(COLORS, i) },
        { name: "Material", value: pick(["Mesh", "Leather", "Canvas"], i) }
      );
      break;
    case "Accessories":
      attrs.push(
        { name: "Color", value: pick(COLORS, i) },
        { name: "Material", value: pick(["Metal", "Leather", "Plastic"], i) }
      );
      break;
  }
  return attrs;
};

/* ---------------- seed ---------------- */

async function main() {
  console.log("Clearing existing data...");
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.review.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.sellerOrder.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.wishlistItem.deleteMany(),
    prisma.question.deleteMany(),
    prisma.priceTier.deleteMany(),
    prisma.productAttribute.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.product.deleteMany(),
    prisma.subcategory.deleteMany(),
    prisma.category.deleteMany(),
    prisma.seller.deleteMany(),
    prisma.address.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log("Users...");
  const password = await bcrypt.hash("password123", 10);
  const buyer = await prisma.user.create({
    data: { email: "buyer@tredella.com", password, name: "Demo Buyer", role: "BUYER" },
  });
  const admin = await prisma.user.create({
    data: { email: "admin@tredella.com", password, name: "Tredella Support", role: "ADMIN" },
  });
  const sellerUser1 = await prisma.user.create({
    data: { email: "seller1@tredella.com", password, name: "Gulf Electronics Hub", role: "SELLER" },
  });
  const sellerUser2 = await prisma.user.create({
    data: { email: "seller2@tredella.com", password, name: "Dubai Fashion House", role: "SELLER" },
  });

  await prisma.address.create({
    data: {
      userId: buyer.id,
      label: "Home",
      fullName: "Demo Buyer",
      phone: "+971 50 123 4567",
      line1: "Al Barsha 1, Villa 12",
      city: "Dubai",
      country: "UAE",
      isDefault: true,
    },
  });

  console.log("Sellers...");
  const sellersData = [
    { slug: "gulf-electronics-hub", name: "Gulf Electronics Hub", verified: true, rating: 4.8, positivePercent: 98, followers: 10400, shipsFrom: "Dubai, UAE", deliveryEstimate: "2-4 Business Days", freeShippingOver: 350, userId: sellerUser1.id, description: "Authorized distributor of consumer electronics across the GCC since 2015." },
    { slug: "al-noor-trading", name: "Al Noor Trading", verified: true, rating: 4.6, positivePercent: 95, followers: 6200, shipsFrom: "Sharjah, UAE", deliveryEstimate: "3-5 Business Days", freeShippingOver: 500, userId: null, description: "Wholesale-first electronics and appliances trader for retailers and resellers." },
    { slug: "dubai-fashion-house", name: "Dubai Fashion House", verified: true, rating: 4.7, positivePercent: 97, followers: 8900, shipsFrom: "Dubai, UAE", deliveryEstimate: "2-4 Business Days", freeShippingOver: 250, userId: sellerUser2.id, description: "Trend-driven apparel and accessories, retail and bulk." },
    { slug: "emirates-style-co", name: "Emirates Style Co.", verified: false, rating: 4.4, positivePercent: 92, followers: 3100, shipsFrom: "Abu Dhabi, UAE", deliveryEstimate: "3-6 Business Days", freeShippingOver: null, userId: null, description: "Footwear and streetwear specialists." },
  ];
  const sellers = [];
  for (const s of sellersData) sellers.push(await prisma.seller.create({ data: s }));

  console.log("Categories...");
  const subMap = new Map<string, { categoryId: string; subcategoryId: string }>();
  for (const cat of CATEGORIES) {
    const category = await prisma.category.create({
      data: { slug: cat.slug, name: cat.name, icon: cat.icon },
    });
    for (const subName of cat.subs) {
      const sub = await prisma.subcategory.create({
        data: { slug: slugify(subName), name: subName, categoryId: category.id },
      });
      subMap.set(`${cat.slug}:${subName}`, { categoryId: category.id, subcategoryId: sub.id });
    }
  }

  console.log("Products...");
  const productIds: string[] = [];
  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i];
    const refs = subMap.get(`${item.category}:${item.subcategory}`)!;
    // electronics → sellers 0/1, fashion → sellers 2/3
    const seller = item.category === "electronics" ? sellers[i % 2] : sellers[2 + (i % 2)];
    const tiers = tiersFor(item.basePrice);

    const product = await prisma.product.create({
      data: {
        slug: slugify(item.name),
        sku: `TRD-${String(i + 1).padStart(4, "0")}`,
        name: item.name,
        description: `${item.name} — quality-checked by ${seller.name}. Available for retail and wholesale across the Gulf with fast delivery from ${seller.shipsFrom}.`,
        image: `/assets/images/products/product-${item.image}.png`,
        brand: brandOf(item.name),
        categoryId: refs.categoryId,
        subcategoryId: refs.subcategoryId,
        sellerId: seller.id,
        retailPrice: item.basePrice,
        oldPrice: round(item.basePrice * 1.25),
        wholesaleFrom: tiers[tiers.length - 1].price,
        stock: 120 + ((i * 37) % 400),
        minOrder: item.minOrder,
        rating: item.rating,
        reviewsCount: item.reviews,
        sold: item.sold,
        deliveryDays: pick(["2-4", "3-5", "4-7"], i),
        freeShipping: i % 3 === 0,
        priceTiers: { create: tiers },
        attributes: { create: attributesFor(item, i) },
        images: {
          create: [
            { url: `/assets/images/products/product-${item.image}.png`, position: 0 },
          ],
        },
      },
    });
    productIds.push(product.id);
  }

  console.log("Demo completed order (for review eligibility)...");
  const orderProducts = await prisma.product.findMany({
    where: { id: { in: productIds.slice(0, 3) } },
    include: { priceTiers: true },
  });
  const order = await prisma.order.create({
    data: {
      userId: buyer.id,
      mode: "RETAIL",
      status: "COMPLETED",
      total: round(orderProducts.reduce((s, p) => s + p.retailPrice, 0)),
    },
  });
  const sellerGroups = new Map<string, typeof orderProducts>();
  for (const p of orderProducts)
    sellerGroups.set(p.sellerId, [...(sellerGroups.get(p.sellerId) ?? []), p]);

  const orderItemIds: { id: string; productId: string }[] = [];
  for (const [sellerId, products] of sellerGroups) {
    const so = await prisma.sellerOrder.create({
      data: {
        orderId: order.id,
        sellerId,
        status: "COMPLETED",
        subtotal: round(products.reduce((s, p) => s + p.retailPrice, 0)),
      },
    });
    for (const p of products) {
      const oi = await prisma.orderItem.create({
        data: {
          sellerOrderId: so.id,
          productId: p.id,
          name: p.name,
          image: p.image,
          mode: "RETAIL",
          quantity: 1,
          unitPrice: p.retailPrice,
          total: p.retailPrice,
        },
      });
      orderItemIds.push({ id: oi.id, productId: p.id });
    }
  }

  console.log("Reviews & questions...");
  // review 2 of the 3 purchased items; the third stays reviewable for testing
  const reviewTexts = [
    "Excellent product, exactly as described. Fast delivery to Dubai.",
    "Great value for money. The seller was responsive and helpful.",
  ];
  for (let i = 0; i < 2; i++) {
    await prisma.review.create({
      data: {
        productId: orderItemIds[i].productId,
        userId: buyer.id,
        orderItemId: orderItemIds[i].id,
        rating: 5 - i,
        text: reviewTexts[i],
        verified: true,
      },
    });
  }

  await prisma.question.create({
    data: {
      productId: productIds[0],
      userId: buyer.id,
      text: "Does this product come in black?",
      answer: "Yes, black is available — select it at checkout or mention it in your bulk quote.",
      answeredAt: new Date(),
    },
  });
  await prisma.question.create({
    data: {
      productId: productIds[0],
      userId: buyer.id,
      text: "Is there a warranty included for wholesale orders?",
    },
  });

  console.log(`Seeded: ${catalog.length} products, ${sellers.length} sellers, 2 categories.`);
  console.log("Demo logins: buyer@tredella.com / admin@tredella.com (password123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
