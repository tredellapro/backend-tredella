/* GraphQL SDL, organized per domain. Kept as template strings (no .graphql
   file loading) so tsx/tsc builds stay simple. */

const common = /* GraphQL */ `
  enum Mode {
    RETAIL
    WHOLESALE
  }

  enum SortBy {
    RELEVANCE
    NEWEST
    PRICE_ASC
    PRICE_DESC
    BEST_RATED
    MOST_POPULAR
    LOWEST_WHOLESALE_PRICE
    BEST_BULK_DISCOUNT
  }

  type PageInfo {
    total: Int!
    page: Int!
    pageSize: Int!
    totalPages: Int!
    hasNextPage: Boolean!
  }
`;

const user = /* GraphQL */ `
  type User {
    id: ID!
    email: String!
    name: String!
    role: String!
    avatar: String
    createdAt: String!
    addresses: [Address!]!
  }

  type Address {
    id: ID!
    label: String!
    fullName: String!
    phone: String!
    line1: String!
    city: String!
    country: String!
    isDefault: Boolean!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type PasswordResetRequestResult {
    "Always true — never reveals whether the email is registered"
    ok: Boolean!
    "False when SMTP is unconfigured (dev): the link is logged to the server console"
    emailSent: Boolean!
  }

  input AddressInput {
    label: String!
    fullName: String!
    phone: String!
    line1: String!
    city: String!
    country: String
    isDefault: Boolean
  }
`;

const catalog = /* GraphQL */ `
  type Category {
    id: ID!
    slug: String!
    name: String!
    icon: String
    subcategories: [Subcategory!]!
    productCount(mode: Mode!): Int!
  }

  type Subcategory {
    id: ID!
    slug: String!
    name: String!
    category: Category!
    productCount(mode: Mode!): Int!
  }

  type PriceTier {
    id: ID!
    minQty: Int!
    maxQty: Int
    price: Float!
  }

  type ProductAttribute {
    name: String!
    value: String!
  }

  type ProductImage {
    id: ID!
    url: String!
    position: Int!
  }

  type Product {
    id: ID!
    slug: String!
    sku: String!
    name: String!
    description: String!
    image: String!
    images: [ProductImage!]!
    brand: String
    category: Category!
    subcategory: Subcategory!
    seller: Seller!
    retailPrice: Float!
    oldPrice: Float
    priceTiers: [PriceTier!]!
    "Cheapest wholesale per-unit price (highest tier)"
    wholesaleFrom: Float
    minOrder: Int!
    stock: Int!
    inStock: Boolean!
    availableRetail: Boolean!
    availableWholesale: Boolean!
    rating: Float!
    reviewsCount: Int!
    sold: Int!
    deliveryDays: String!
    freeShipping: Boolean!
    attributes: [ProductAttribute!]!
    createdAt: String!
  }

  type ProductConnection {
    items: [Product!]!
    pageInfo: PageInfo!
    "Dynamic facets for the current result set (attribute name -> values)"
    facets: [Facet!]!
    brands: [String!]!
    priceRange: PriceRange!
  }

  type Facet {
    name: String!
    values: [FacetValue!]!
  }

  type FacetValue {
    value: String!
    count: Int!
  }

  type PriceRange {
    min: Float!
    max: Float!
  }

  "Quote for a quantity — calculated server-side from DB tiers"
  type PriceQuote {
    quantity: Int!
    unitPrice: Float!
    total: Float!
    mode: Mode!
  }

  input AttributeFilterInput {
    name: String!
    values: [String!]!
  }

  input ProductFilterInput {
    search: String
    categorySlug: String
    subcategorySlug: String
    sellerSlug: String
    brands: [String!]
    priceMin: Float
    priceMax: Float
    minRating: Float
    inStock: Boolean
    onSale: Boolean
    maxMoq: Int
    attributes: [AttributeFilterInput!]
  }

  type HomePageData {
    heroProducts: [Product!]!
    flashDeals: [Product!]!
    topRated: [Product!]!
    newArrivals: [Product!]!
    bigDiscounts: [Product!]!
    categories: [Category!]!
  }
`;

const seller = /* GraphQL */ `
  type Seller {
    id: ID!
    slug: String!
    name: String!
    logo: String
    description: String
    verified: Boolean!
    rating: Float!
    positivePercent: Float!
    followers: Int!
    shipsFrom: String!
    deliveryEstimate: String!
    freeShippingOver: Float
    joinedAt: String!
    productCount: Int!
  }
`;

const reviewsQuestions = /* GraphQL */ `
  type Review {
    id: ID!
    rating: Int!
    text: String!
    images: [String!]!
    verified: Boolean!
    createdAt: String!
    user: PublicUser!
  }

  type PublicUser {
    id: ID!
    name: String!
    avatar: String
  }

  type ReviewConnection {
    items: [Review!]!
    pageInfo: PageInfo!
    average: Float!
    "Count per star rating 1..5"
    distribution: [Int!]!
  }

  type Question {
    id: ID!
    text: String!
    answer: String
    answeredAt: String
    createdAt: String!
    user: PublicUser!
  }
`;

const cartOrders = /* GraphQL */ `
  type CartItem {
    id: ID!
    product: Product!
    quantity: Int!
    mode: Mode!
    "Current unit price for this quantity — server calculated"
    unitPrice: Float!
    total: Float!
  }

  type SellerCartGroup {
    seller: Seller!
    items: [CartItem!]!
    subtotal: Float!
  }

  type Cart {
    groups: [SellerCartGroup!]!
    itemCount: Int!
    total: Float!
  }

  type Order {
    id: ID!
    mode: Mode!
    status: String!
    total: Float!
    createdAt: String!
    address: Address
    sellerOrders: [SellerOrder!]!
  }

  type SellerOrder {
    id: ID!
    seller: Seller!
    status: String!
    subtotal: Float!
    items: [OrderItem!]!
  }

  type OrderItem {
    id: ID!
    product: Product!
    name: String!
    image: String!
    mode: Mode!
    quantity: Int!
    unitPrice: Float!
    total: Float!
    "True if the buyer can review this item now"
    reviewable: Boolean!
  }

  type WishlistItem {
    id: ID!
    product: Product!
    mode: Mode!
    createdAt: String!
  }
`;

const chatNotifications = /* GraphQL */ `
  type Conversation {
    id: ID!
    type: String!
    seller: Seller
    product: Product
    orderId: String
    lastMessage: Message
    unreadCount: Int!
    updatedAt: String!
  }

  type Message {
    id: ID!
    conversationId: ID!
    sender: PublicUser!
    text: String!
    attachment: String
    readAt: String
    createdAt: String!
    isMine: Boolean!
  }

  type Notification {
    id: ID!
    type: String!
    title: String!
    body: String
    link: String
    readAt: String
    createdAt: String!
  }
`;

const operations = /* GraphQL */ `
  type Query {
    me: User
    "Checks a reset link before showing the new-password form"
    verifyResetToken(token: String!): Boolean!

    getHomePageData(mode: Mode!): HomePageData!
    getCategories: [Category!]!
    getCategory(slug: String!): Category
    getSubcategory(categorySlug: String!, slug: String!): Subcategory

    getProducts(
      mode: Mode!
      filter: ProductFilterInput
      sortBy: SortBy = RELEVANCE
      page: Int = 1
      pageSize: Int = 12
    ): ProductConnection!

    getProduct(slug: String!, mode: Mode!): Product
    getPriceQuote(productId: ID!, quantity: Int!, mode: Mode!): PriceQuote!
    getRelatedProducts(productId: ID!, mode: Mode!, limit: Int = 8): [Product!]!

    getSeller(slug: String!): Seller
    getSellerProducts(
      sellerSlug: String!
      mode: Mode!
      filter: ProductFilterInput
      sortBy: SortBy = RELEVANCE
      page: Int = 1
      pageSize: Int = 12
    ): ProductConnection!

    getProductReviews(productId: ID!, page: Int = 1, pageSize: Int = 10): ReviewConnection!
    getProductQuestions(productId: ID!): [Question!]!

    getWishlist(mode: Mode): [WishlistItem!]!
    getCart(mode: Mode!): Cart!
    getOrders(page: Int = 1, pageSize: Int = 10): [Order!]!
    getOrder(id: ID!): Order

    getNotifications(unreadOnly: Boolean = false): [Notification!]!
    getConversations: [Conversation!]!
    getMessages(conversationId: ID!, page: Int = 1, pageSize: Int = 30): [Message!]!

    searchSuggestions(query: String!, mode: Mode!): [String!]!
  }

  type Mutation {
    register(name: String!, email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    addAddress(input: AddressInput!): Address!

    "Always reports success so the response cannot reveal registered emails"
    requestPasswordReset(email: String!): PasswordResetRequestResult!
    "Signs the user straight in once the new password is saved"
    resetPassword(token: String!, newPassword: String!): AuthPayload!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!

    "Pass either productId or productSlug — the slug is the stable public key"
    addToWishlist(productId: ID, productSlug: String, mode: Mode!): WishlistItem!
    removeFromWishlist(productId: ID, productSlug: String, mode: Mode!): Boolean!

    addToCart(productId: ID, productSlug: String, quantity: Int!, mode: Mode!): Cart!
    updateCartItem(cartItemId: ID!, quantity: Int!): Cart!
    removeFromCart(cartItemId: ID!): Cart!

    createOrder(mode: Mode!, addressId: ID): Order!

    createReview(orderItemId: ID!, rating: Int!, text: String!, images: [String!]): Review!
    askProductQuestion(productId: ID!, text: String!): Question!

    startConversation(type: String!, sellerSlug: String, productId: ID, orderId: ID): Conversation!
    sendMessage(conversationId: ID!, text: String!, attachment: String): Message!
    markMessageAsRead(conversationId: ID!): Boolean!
    markNotificationAsRead(id: ID): Boolean!
  }

  type Subscription {
    messageAdded(conversationId: ID!): Message!
    notificationAdded: Notification!
  }
`;

export const typeDefs = [
  common,
  user,
  catalog,
  seller,
  reviewsQuestions,
  cartOrders,
  chatNotifications,
  operations,
].join("\n");
