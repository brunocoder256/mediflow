// Curated, reviewed help content for "Ask MediFlow IQ".
//
// IMPORTANT: content here is derived from the ACTUAL implementation of the app
// (pages, forms, navigation, permissions and offline behaviour). Do not add
// instructions for features that are not shipped unless you mark them as
// `status: "planned"`. This file contains no secrets and performs no I/O.

import type { HelpArticle } from "./types";

/** Module keys → human labels, used for badges and contextual suggestions. */
export const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  pos: "POS",
  cash: "Cash",
  products: "Products",
  inventory: "Inventory",
  purchases: "Purchases",
  suppliers: "Suppliers",
  sales: "Sales",
  returns: "Returns",
  expenses: "Expenses",
  customers: "Customers",
  reports: "Reports",
  users: "Users & roles",
  audit: "Audit",
  settings: "Settings",
  offline: "Offline & sync",
  access: "Account access",
  getting_started: "Getting started",
};

/** Verified internal route → module key (mirrors the sidebar + RBAC map). */
export const ROUTE_TO_MODULE: Record<string, string> = {
  "/dashboard": "dashboard",
  "/pos": "pos",
  "/cash": "cash",
  "/products": "products",
  "/inventory": "inventory",
  "/purchases": "purchases",
  "/suppliers": "suppliers",
  "/sales": "sales",
  "/returns": "returns",
  "/expenses": "expenses",
  "/customers": "customers",
  "/reports": "reports",
  "/users": "users",
  "/audit": "audit",
  "/settings": "settings",
  "/sync": "offline",
};

/** Suggested prompts shown on the empty state (module-agnostic). */
export const EXAMPLE_QUESTIONS: string[] = [
  "How do I use the POS?",
  "How do I add a new medicine?",
  "How can I check expired stock?",
  "How do I record a supplier purchase?",
  "How does offline mode work?",
  "Why can't I access Reports?",
];

/** Contextual suggestions per module. */
export const MODULE_QUESTIONS: Record<string, string[]> = {
  pos: ["How do I complete a sale?", "How do I hold a sale?", "Which payment methods are supported?"],
  cash: ["How do I open a cash session?", "How do I close cash at the end of the day?"],
  products: ["How do I add a product?", "How do I edit a product?"],
  inventory: ["How do I check low stock?", "How can I check expired stock?", "How do I adjust stock?"],
  purchases: ["How do I create a purchase order?", "How do I receive goods into inventory?", "How do I pay a supplier?"],
  suppliers: ["How do I add a supplier?", "How do I record a supplier payment?"],
  sales: ["How do I view sales history?", "How do I reprint a receipt?"],
  returns: ["How do I process a customer return?", "How do I return goods to a supplier?"],
  expenses: ["How do I record an expense?"],
  customers: ["How do I add a customer?", "How do I create a credit sale?"],
  reports: ["How do I generate a report?", "How do I export a report?"],
  users: ["How do I add a user?", "How do I set roles and permissions?"],
  audit: ["How do I view the audit log?"],
  settings: ["How do I change organization settings?"],
  offline: ["How does offline mode work?", "Why are my offline changes not syncing?"],
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "getting-started-navigation",
    module: "getting_started",
    moduleLabel: "Getting started",
    title: "Getting around MediFlow IQ",
    intro:
      "MediFlow IQ is a pharmacy and drug-shop management system. Use the left sidebar to move between modules and the top bar for branch, online/offline status, notifications and your account.",
    questions: [
      "How do I get around MediFlow IQ?",
      "What are the modules in the system?",
      "How do I navigate the app?",
    ],
    phrasings: [
      "what can i do in this system",
      "where do i find each feature",
      "describe the main menu",
    ],
    keywords: ["navigation", "sidebar", "menu", "topbar", "modules", "overview", "start"],
    steps: [
      "The sidebar lists every module: Dashboard, POS, Cash, Products, Inventory, Purchases, Suppliers, Sales, Returns, Expenses, Customers, Reports, Users, Audit and Settings.",
      "The top bar lets you pick the current branch, see the live online/offline indicator, open notifications, open Help, switch theme and open your account menu.",
      "Work is saved as you go — nothing needs to be pressed to save — and every important action is recorded in the Audit log.",
    ],
    warnings: [
      "Always confirm the branch selector in the top bar shows the store you are working in. Sales, stock and cash are tracked per branch.",
    ],
    relatedArticleIds: ["offline-mode", "dashboard-overview", "access-permissions"],
    route: "/dashboard",
    permission: "dashboard.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "dashboard-overview",
    module: "dashboard",
    moduleLabel: "Dashboard",
    title: "Understanding the Dashboard",
    intro:
      "The Dashboard is your home screen with a live snapshot of the business: today's sales, low-stock and expiring products, pending approvals and recent activity.",
    questions: [
      "What does the Dashboard show?",
      "How do I read the dashboard cards?",
      "Where do I see today's sales?",
    ],
    phrasings: ["what do the kpis mean", "explain the dashboard", "home screen overview"],
    keywords: ["dashboard", "home", "kpi", "sales today", "low stock", "expiring", "trend", "chart"],
    steps: [
      "Open Dashboard from the sidebar (or Home). The KPI cards show today's sales, transactions, gross and net profit, expenses, low stock, expiring soon and expired items.",
      "Click a card or an item under \"Needs Attention\" to jump straight to the relevant module (for example Inventory for low stock).",
      "The sales trend chart covers the last 7 days and the top-products chart shows today's best sellers.",
    ],
    relatedArticleIds: ["inventory-stock-levels", "sales-history", "notifications-help"],
    route: "/dashboard",
    permission: "dashboard.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "pos-complete-sale",
    module: "pos",
    moduleLabel: "POS",
    title: "Complete a sale in the POS",
    intro:
      "The POS is the sales counter. Scan or search a product, take payment and print the receipt in a few seconds.",
    questions: [
      "How do I use the POS?",
      "How do I make a sale?",
      "How do I sell a product?",
      "How does a cashier complete a transaction?",
    ],
    phrasings: [
      "how can i sell medicine",
      "how do i checkout a customer",
      "how do i ring up a sale",
      "process a transaction at the counter",
    ],
    keywords: [
      "pos", "sell", "sale", "checkout", "cart", "basket", "scan", "barcode", "receipt",
      "payment", "hold", "cashier", "counter", "transaction",
    ],
    prerequisites: ["For cash payments, open a cash session first (or the sale is queued for a session)."],
    steps: [
      "Search or scan a product by name, generic name, brand, SKU or barcode. Press Ctrl+K to focus the search box.",
      "Press Enter to add the highlighted product to the cart (press Enter again on the cart to sell it).",
      "Adjust quantities, then apply a per-line discount or a whole-sale discount if needed.",
      "Choose the payment method: Cash, Mobile Money, Card, Bank or Other. You can split one sale across several methods.",
      "Use Hold to park the cart and serve the next customer; resume held baskets from the Held list.",
      "Confirm payment — the receipt prints and the sale is recorded in Sales.",
    ],
    warnings: [
      "Cash sales need an open cash session. If there is none, the sale is queued and attached automatically when a session is opened.",
    ],
    troubleshooting: [
      "Product not found? It may not be created yet or the branch has no stock — check Products and Inventory.",
      "\"Insufficient stock\" means the selected batch has less than the requested quantity.",
      "Working offline? The sale is queued and syncs automatically when you reconnect.",
    ],
    options: [
      {
        label: "The product doesn't appear in search",
        intro: "If the item is not in the search results it is usually a product or stock issue, not a POS issue.",
        steps: [
          "Open Products and confirm the product exists and is active.",
          "Open Inventory and confirm the selected branch has stock for it.",
          "Create the product or receive stock for the branch, then try the sale again.",
        ],
      },
      {
        label: "It says insufficient stock",
        intro: "The batch or product has less stock than you are trying to sell.",
        steps: [
          "In the cart, reduce the quantity to the amount available.",
          "Check Inventory → the product's batches for the exact quantity on hand.",
          "If stock is wrong, receive the goods (Purchases) or post a stock adjustment before selling.",
        ],
      },
      {
        label: "Payment can't be completed",
        intro: "Payment problems are usually a cash-session or connectivity issue.",
        steps: [
          "For cash, make sure a cash session is open (Cash module).",
          "Confirm the amount tendered is at least the sale total.",
          "If you are offline, continue — the sale is queued and will sync automatically.",
        ],
      },
    ],
    relatedArticleIds: ["cash-sessions", "sales-history", "returns-customer", "offline-mode"],
    relatedQuestions: ["How do I hold a sale?", "How do I reprint a receipt?"],
    route: "/pos",
    permission: "sales.create",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "products-add",
    module: "products",
    moduleLabel: "Products",
    title: "Add a product / medicine",
    intro:
      "Products is the master catalogue of everything you sell — its price, unit and stock information.",
    questions: [
      "How do I add a product?",
      "How do I add a new medicine?",
      "How do I create a new item?",
    ],
    phrasings: [
      "how do i register a new drug",
      "add a medicine to the system",
      "create a product in the catalogue",
    ],
    keywords: [
      "product", "medicine", "drug", "add", "create", "register", "category", "unit",
      "sku", "barcode", "price", "cost", "catalogue", "catalog",
    ],
    prerequisites: ["You need the Create Products permission."],
    steps: [
      "Open Products from the sidebar and choose Add Product (the + / New button).",
      "Enter the product name, category and selling unit.",
      "Add the SKU and/or barcode if you have them (helps POS search and scanning).",
      "Set the cost price and the selling price.",
      "Set the opening stock quantity and expiry date where applicable.",
      "Save. The product is now available in the POS and Inventory.",
    ],
    warnings: [
      "Units and categories are available offline too, so you can add products without a connection.",
    ],
    troubleshooting: [
      "Can't save? A required field (usually name or price) is missing, or your account lacks the Create Products permission.",
      "Can't find the new product in POS? Confirm your current branch has stock for it.",
    ],
    options: [
      {
        label: "I don't have the Add Product button",
        intro: "The Add Product action requires the Create Products permission.",
        steps: [
          "Ask an administrator to grant you the products.create permission (Users → Roles).",
          "Reload the page after your permissions are updated.",
        ],
      },
      {
        label: "The product saves but shows zero stock",
        intro: "A product record and its stock are separate. Stock comes from receiving or from the opening quantity.",
        steps: [
          "Open Inventory and check the product for the current branch.",
          "Receive goods against a purchase order, or post an opening stock adjustment.",
        ],
      },
    ],
    relatedArticleIds: ["inventory-stock-levels", "purchases-create", "pos-complete-sale"],
    route: "/products",
    permission: "products.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "inventory-stock-levels",
    module: "inventory",
    moduleLabel: "Inventory",
    title: "Check stock levels and low stock",
    intro:
      "Inventory tracks stock on hand versus reorder levels for each branch, and follows every movement in and out.",
    questions: [
      "How do I check stock levels?",
      "How do I see low stock items?",
      "How do I view inventory?",
    ],
    phrasings: [
      "where do i see quantity on hand",
      "how many units do i have left",
      "show me products below reorder level",
    ],
    keywords: [
      "inventory", "stock", "stock level", "quantity", "on hand", "low stock",
      "reorder", "movement", "adjustment", "branch",
    ],
    steps: [
      "Open Inventory from the sidebar.",
      "Use the search and filters to find a product, batch or supplier.",
      "Items below their reorder level are highlighted, and the Dashboard low-stock count links here.",
      "Open an item to see its stock-on-hand, reorder level and movement history.",
    ],
    troubleshooting: [
      "Stock looks wrong? Check the movement history for the product to see purchases, sales, returns and adjustments.",
      "A low-stock alert means quantity is at or below the reorder level — create a purchase order to restock.",
    ],
    relatedArticleIds: ["inventory-expiry", "purchases-create", "dashboard-overview"],
    route: "/inventory",
    permission: "inventory.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "inventory-expiry",
    module: "inventory",
    moduleLabel: "Inventory",
    title: "Check expired and expiring stock",
    intro:
      "MediFlow IQ tracks batches with expiry dates so expiring stock is flagged before it expires.",
    questions: [
      "How do I check expired stock?",
      "How do I find expiring products?",
      "How do I see expiry dates?",
    ],
    phrasings: [
      "which batches are expired",
      "show products expiring soon",
      "how do i track expiry",
    ],
    keywords: [
      "expiry", "expire", "expired", "expiring", "batch", "date", "short dated",
      "inventory", "disposal", "remove",
    ],
    steps: [
      "Open Inventory and look at the expiry indicators, or filter/sort by expiry date.",
      "The Dashboard shows counts for items expiring within 30 days and for already-expired batches.",
      "Open a batch to see its expiry date and quantity.",
      "For expired goods, use the disposal workflow (PENDING → APPROVED → DISPOSED) to remove them from sellable stock.",
    ],
    warnings: [
      "Do not sell expired batches. Dispose of them so they leave sellable stock.",
    ],
    relatedArticleIds: ["inventory-stock-levels", "dashboard-overview"],
    route: "/inventory",
    permission: "inventory.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "purchases-create",
    module: "purchases",
    moduleLabel: "Purchases",
    title: "Record a supplier purchase",
    intro:
      "Purchase orders let you order stock from suppliers, approve it, receive it into inventory and pay against it.",
    questions: [
      "How do I record a purchase?",
      "How do I create a purchase order?",
      "How do I order stock from a supplier?",
    ],
    phrasings: [
      "how do i restock from a vendor",
      "create a po",
      "add a new purchase order",
    ],
    keywords: [
      "purchase", "purchase order", "po", "order", "supplier", "vendor", "stock in",
      "restock", "draft", "approve", "receive", "grn", "cost", "reorder",
    ],
    prerequisites: ["The supplier should exist in Suppliers, but you can also create one while ordering."],
    steps: [
      "Open Purchases and choose New Purchase Order.",
      "Pick the supplier and the branch the goods are for.",
      "Add products with the ordered quantity and unit cost.",
      "Save as a draft, then move it through its status flow (for example Ordered → Approved).",
      "When the goods arrive, receive them — this puts the stock into inventory automatically (GRN).",
      "Record payments against the purchase order from the detail page; the outstanding balance updates from real transactions.",
    ],
    warnings: [
      "A purchase order stays in the supplier's outstanding balance until it is paid, even before the goods are received.",
      "You can only cancel a purchase order before it is received.",
    ],
    troubleshooting: [
      "Can't receive? The order may still be in draft — approve it first.",
      "Stock didn't change? Receiving (GRN) is the step that adds stock; saving the order alone does not.",
    ],
    options: [
      {
        label: "The order won't approve",
        intro: "Approval requires the Approve Purchases permission and a valid supplier/products.",
        steps: [
          "Confirm you have the purchases.approve permission.",
          "Make sure a supplier and at least one product line are set.",
        ],
      },
      {
        label: "Received goods but stock is unchanged",
        intro: "Stock only increases when you complete the goods-received step for the correct branch.",
        steps: [
          "Open the purchase order and choose Receive, then confirm the quantities.",
          "Check Inventory for the branch the order was placed for.",
        ],
      },
    ],
    relatedArticleIds: ["suppliers-manage", "inventory-stock-levels", "offline-mode"],
    route: "/purchases",
    permission: "purchases.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "suppliers-manage",
    module: "suppliers",
    moduleLabel: "Suppliers",
    title: "Manage suppliers and payments",
    intro:
      "Suppliers is the supplier master with outstanding balances, payments and a full history per supplier.",
    questions: [
      "How do I add a supplier?",
      "How do I record a supplier payment?",
      "How do I see what I owe a supplier?",
    ],
    phrasings: [
      "add a vendor",
      "pay a supplier",
      "supplier outstanding balance",
    ],
    keywords: [
      "supplier", "vendor", "distributor", "payment", "balance", "outstanding",
      "credit", "ledger", "statement", "return",
    ],
    steps: [
      "Open Suppliers and choose Add Supplier.",
      "Enter the supplier details and save.",
      "Open a supplier to see its full detail: purchase orders, goods received, payments, pricing, returns and documents.",
      "Record a payment from the detail page (Cash, Mobile, Bank, Card, etc.) — the balance recalculates automatically.",
      "Outstanding balance = open purchase orders minus payments and returns.",
    ],
    warnings: [
      "Small credit-limit changes apply instantly; larger ones need approval.",
    ],
    relatedArticleIds: ["purchases-create", "returns-purchase"],
    route: "/suppliers",
    permission: "suppliers.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "sales-history",
    module: "sales",
    moduleLabel: "Sales",
    title: "View sales history and receipts",
    intro:
      "Sales is the history of every completed transaction, with filters and exports.",
    questions: [
      "How do I view sales history?",
      "How do I find a sale?",
      "How do I reprint a receipt?",
    ],
    phrasings: [
      "where do i see past sales",
      "search for a transaction",
      "print a customer receipt again",
    ],
    keywords: ["sales", "history", "transaction", "receipt", "print", "filter", "export", "payment"],
    steps: [
      "Open Sales from the sidebar.",
      "Filter by date range, branch, payment method, status or search by customer/receipt number.",
      "Open a sale to view its items, payments and printed receipt.",
      "Print or reprint the receipt from the sale detail.",
      "Raise a return from a sale when a customer brings stock back.",
    ],
    relatedArticleIds: ["returns-customer", "reports-generate", "pos-complete-sale"],
    route: "/sales",
    permission: "sales.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "returns-customer",
    module: "returns",
    moduleLabel: "Returns",
    title: "Process a customer return",
    intro:
      "Customer returns credit the sale/customer back and put the stock back on the shelf, following an approval flow where required.",
    questions: [
      "How do I process a return?",
      "How do I refund a customer?",
      "How do I take back stock a customer returned?",
    ],
    phrasings: ["customer brings back medicine", "return an item to the shelf", "refund a sale"],
    keywords: ["return", "refund", "exchange", "customer", "credit note", "approval", "stock back"],
    steps: [
      "Open Returns (or open the original sale in Sales and choose Return).",
      "Select the sale and the items being returned with quantities.",
      "Choose the reason (for example damaged or wrong item).",
      "Submit — the return follows the approval flow where required.",
      "Once approved, stock is returned to inventory and the customer/sale is credited.",
    ],
    relatedArticleIds: ["returns-purchase", "sales-history"],
    route: "/returns",
    permission: "sales.return",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "returns-purchase",
    module: "returns",
    moduleLabel: "Returns",
    title: "Return goods to a supplier",
    intro:
      "Purchase returns send goods back to a supplier and reduce what you owe them.",
    questions: [
      "How do I return goods to a supplier?",
      "How do I send back damaged stock to a vendor?",
    ],
    phrasings: ["purchase return", "send stock back to supplier"],
    keywords: ["return", "supplier", "purchase return", "vendor", "damaged", "expired", "credit"],
    steps: [
      "Open Returns and choose the purchase/return type.",
      "Select the original purchase (GRN) and the batch to return.",
      "Choose the reason (Damaged, Expired, Short-dated, Wrong item, etc.) and quantity.",
      "Submit — stock is removed from inventory and a credit is raised against the supplier.",
    ],
    relatedArticleIds: ["returns-customer", "suppliers-manage", "purchases-create"],
    route: "/returns",
    permission: "sales.return",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "cash-sessions",
    module: "cash",
    moduleLabel: "Cash",
    title: "Open and close a cash session",
    intro:
      "Cash management tracks sessions, opening floats and cash movements for each drawer.",
    questions: [
      "How do I open a cash session?",
      "How do I close cash at the end of the day?",
      "How do I record a cash withdrawal?",
    ],
    phrasings: ["start a shift at the till", "reconcile the drawer", "cash in cash out", "end of day cash"],
    keywords: ["cash", "session", "drawer", "float", "opening", "closing", "reconcile", "cash in", "cash out", "petty cash", "variance"],
    steps: [
      "Open Cash from the sidebar.",
      "Open a session at the start of the day with an opening float.",
      "Record cash-in and cash-out movements (withdrawals, petty cash, deposits) against the active session.",
      "At the end of the day, enter the counted cash and close the session.",
      "The system reconciles expected versus counted cash and keeps a register history per drawer.",
    ],
    warnings: [
      "POS cash sales need an open cash session. If none is open, cash sales queue and attach to the next session.",
    ],
    relatedArticleIds: ["pos-complete-sale", "expenses-record", "offline-mode"],
    route: "/cash",
    permission: "sales.create",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "expenses-record",
    module: "expenses",
    moduleLabel: "Expenses",
    title: "Record an expense",
    intro: "Expenses logs money going out of the business against a category and payment method.",
    questions: [
      "How do I record an expense?",
      "How do I log a business cost?",
      "How do I add an expense category?",
    ],
    phrasings: ["track money spent", "record rent or utilities", "log a payment out"],
    keywords: ["expense", "cost", "category", "payment", "spending", "rent", "utilities", "cash session"],
    steps: [
      "Open Expenses and choose New Expense.",
      "Pick or add the category and choose the payment method.",
      "Enter the amount, date and any notes; link it to a cash session when relevant.",
      "Save. The expense is recorded and included in expense summaries and reports.",
    ],
    relatedArticleIds: ["reports-generate", "cash-sessions", "offline-mode"],
    route: "/expenses",
    permission: "expenses.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "customers-manage",
    module: "customers",
    moduleLabel: "Customers",
    title: "Add and manage customers",
    intro:
      "Customers stores who you sell to, including walk-in sales and any balances.",
    questions: [
      "How do I add a customer?",
      "How do I search for a customer?",
      "How do I create a walk-in sale?",
    ],
    phrasings: ["register a client", "add a buyer", "customer balance"],
    keywords: ["customer", "client", "buyer", "walkin", "balance", "credit", "phone", "loyalty"],
    steps: [
      "Open Customers and choose Add Customer.",
      "Enter the name and optional phone/email, then save.",
      "Search customers by name or phone to link them to a sale.",
      "Walk-in/quick sales can be recorded without creating a full customer record.",
      "Customer balances and credit notes appear on their profile.",
    ],
    relatedArticleIds: ["pos-complete-sale", "sales-history", "offline-mode"],
    route: "/customers",
    permission: "customers.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "reports-generate",
    module: "reports",
    moduleLabel: "Reports",
    title: "Generate and export reports",
    intro:
      "Reports provides sales, purchases, inventory and profitability analytics by period and branch.",
    questions: [
      "How do I generate a report?",
      "How do I export a report?",
      "Where do I see profit?",
    ],
    phrasings: ["run an analytics report", "download sales report", "print a report", "view margins"],
    keywords: ["report", "reporting", "export", "csv", "excel", "pdf", "print", "profit", "margin", "sales report", "purchase report", "inventory report", "analytics"],
    prerequisites: ["Financial and profit figures require the matching report permissions."],
    steps: [
      "Open Reports from the sidebar.",
      "Choose the report type (sales, purchases, inventory, profitability).",
      "Set the date range and branch filters.",
      "Review the figures — they are computed from real transactions, nothing is hardcoded.",
      "Export to CSV, Excel or PDF, or print directly.",
    ],
    warnings: [
      "Some financial reports require extra permissions (View Financial Reports, View Profit, View Costs). If a report is missing or empty, ask an administrator to grant the report permission.",
    ],
    troubleshooting: [
      "Empty report? Check the date range and branch filter first.",
      "Still empty? There may simply be no transactions in that period.",
    ],
    options: [
      {
        label: "The report is empty",
        intro: "Empty reports are usually a filter problem or genuinely no activity in the period.",
        steps: [
          "Widen the date range and confirm the selected branch.",
          "Check Sales/Purchases for transactions in that period.",
        ],
      },
      {
        label: "I can't see profit figures",
        intro: "Profit and cost figures are guarded by separate permissions.",
        steps: [
          "Ask an administrator to grant reports.view_financial, reports.view_profit or reports.view_costs.",
          "Reload the page after your permissions are updated.",
        ],
      },
    ],
    relatedArticleIds: ["sales-history", "expenses-record", "access-permissions"],
    route: "/reports",
    permission: "reports.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "users-roles",
    module: "users",
    moduleLabel: "Users & roles",
    title: "Add users, roles and permissions",
    intro:
      "Invite your team, assign roles with the right permissions, and control access per branch.",
    questions: [
      "How do I add a user?",
      "How do I set roles and permissions?",
      "How do I invite staff?",
    ],
    phrasings: ["create a staff account", "manage team access", "assign a role", "give someone access"],
    keywords: ["user", "staff", "employee", "invite", "role", "permission", "access", "branch", "team", "account"],
    prerequisites: ["You need the View Users permission; creating/editing needs the matching user permissions."],
    steps: [
      "Open Users from the sidebar.",
      "Choose Add User and enter the person's details.",
      "Assign a role (admin, manager, cashier, viewer) and the branches they can access.",
      "Save. Permissions take effect the next time the page is loaded for that user.",
      "Manage roles and their permissions from the Roles section.",
    ],
    warnings: [
      "The system prevents removing the last administrator of an organization.",
    ],
    troubleshooting: [
      "A user can see a page but not act? They have the View permission but not the Create/Edit permission.",
      "A user can't see a module at all? Grant the module's View permission for their role or add a permission override.",
    ],
    relatedArticleIds: ["access-permissions", "audit-log", "getting-started-navigation"],
    route: "/users",
    permission: "users.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "audit-log",
    module: "audit",
    moduleLabel: "Audit",
    title: "View the audit log",
    intro: "The Audit log records who did what and when across the system.",
    questions: [
      "How do I view the audit log?",
      "How do I see who changed something?",
      "Where is the activity history?",
    ],
    phrasings: ["see system activity", "check who edited a record", "audit trail"],
    keywords: ["audit", "log", "history", "activity", "trail", "who", "changes"],
    steps: [
      "Open Audit from the sidebar.",
      "Filter by user, action, entity or date to find a specific change.",
      "Open a row to see the old and new values where recorded.",
      "Export the audit log if you need it for review.",
    ],
    relatedArticleIds: ["users-roles", "access-permissions"],
    route: "/audit",
    permission: "audit.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "settings-org",
    module: "settings",
    moduleLabel: "Settings",
    title: "Change organization settings",
    intro:
      "Settings holds organization-wide preferences such as branches, currency, tax and other options.",
    questions: [
      "How do I change settings?",
      "How do I manage branches?",
      "How do I set currency or tax?",
    ],
    phrasings: ["configure the system", "organization preferences", "add a branch"],
    keywords: ["settings", "preference", "configuration", "branch", "currency", "tax", "organization", "theme"],
    steps: [
      "Open Settings from the sidebar.",
      "Update the option you need (default branch/currency, tax behaviour, organization details).",
      "Manage users, roles and permissions from their dedicated sections.",
      "Save your changes.",
    ],
    relatedArticleIds: ["users-roles", "getting-started-navigation"],
    route: "/settings",
    permission: "settings.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "offline-mode",
    module: "offline",
    moduleLabel: "Offline & sync",
    title: "Work offline and sync later",
    intro:
      "MediFlow IQ keeps working without internet. Everything you create is stored on the device and syncs automatically when you reconnect.",
    questions: [
      "How does offline mode work?",
      "How do I work without internet?",
      "How do I sync offline changes?",
    ],
    phrasings: [
      "the internet is down can i still sell",
      "what happens when connection drops",
      "sync my pending changes",
    ],
    keywords: ["offline", "connection", "internet", "network", "sync", "pending", "queue", "autosync", "reconnect", "cached"],
    steps: [
      "When the top-bar indicator is red you are offline. Everything you create is stored on the device and shown in the Pending panel.",
      "As soon as the connection returns, queued work syncs automatically in the background — no refresh needed.",
      "Sales, purchases (create/confirm/receive/pay), supplier payments, expenses, customers, products, returns and cash sessions all queue while offline.",
      "Open the Sync Center to see pending items and to sync or dismiss them manually.",
    ],
    warnings: [
      "If a queued item conflicts (for example a duplicate customer), it is flagged as failed for review instead of being silently dropped.",
    ],
    troubleshooting: [
      "Offline changes not syncing? Check the top-bar indicator; when it turns green, sync runs automatically.",
      "A failed item stays failed until you review it in the Sync Center and dismiss or correct it.",
    ],
    options: [
      {
        label: "My offline changes are stuck as pending",
        intro: "Pending items sync automatically once the server is reachable again.",
        steps: [
          "Check the top-bar indicator says Online (green).",
          "Open the Sync Center and press Sync Now.",
          "If an item is Failed, open it to see the reason, then dismiss or correct it.",
        ],
      },
      {
        label: "A queued item is marked Failed",
        intro: "Failed items usually conflict with existing data (for example a duplicate).",
        steps: [
          "Open the Sync Center and select the failed item to read the error.",
          "Fix the underlying data (for example the duplicate customer) and re-create the record.",
          "Dismiss the failed queue entry to clear it.",
        ],
      },
    ],
    relatedArticleIds: ["pos-complete-sale", "getting-started-navigation"],
    route: "/sync",
    permission: null,
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "notifications-help",
    module: "dashboard",
    moduleLabel: "Notifications",
    title: "Using notifications",
    intro: "The bell at the top tells you what needs attention.",
    questions: [
      "What do the notifications mean?",
      "How do I clear notifications?",
      "Why is there a bell badge?",
    ],
    phrasings: ["alert bell", "notifications menu", "mark all read"],
    keywords: ["notification", "alert", "bell", "badge", "low stock", "expiry", "pending", "read"],
    steps: [
      "Click the bell in the top bar to open notifications.",
      "Low-stock and expiring items raise alerts so you can reorder in time.",
      "Pending purchase approvals and queued offline work are surfaced here too.",
      "Mark items as read (or mark all read) to keep the badge clean.",
    ],
    relatedArticleIds: ["dashboard-overview", "inventory-expiry", "offline-mode"],
    route: "/dashboard",
    permission: "dashboard.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
  {
    id: "access-permissions",
    module: "access",
    moduleLabel: "Account access",
    title: "Why can't I access a page or action?",
    intro:
      "MediFlow IQ uses role-based access control. Pages and actions are hidden unless your role has the matching permission.",
    questions: [
      "Why can't I access Reports?",
      "Why can't I open a page?",
      "Why don't I have permission?",
      "Why is a menu item missing?",
    ],
    phrasings: [
      "i cannot see a module",
      "i get forbidden when i open a page",
      "my menu is missing options",
      "why am i denied access",
      "how do i get access to a feature",
    ],
    keywords: [
      "access", "permission", "role", "forbidden", "denied", "unauthorized",
      "missing menu", "cannot open", "reports", "pos", "users", "settings",
    ],
    steps: [
      "Most pages need a View permission for that module (for example reports.view, products.view, inventory.view).",
      "Actions need extra permissions (for example products.create to add a product, users.manage_roles to manage roles).",
      "If a menu item or page is missing, ask an administrator to grant the permission for your role, or to add a permission override for you.",
      "Your access is also limited to the branches assigned to you.",
    ],
    warnings: [
      "Permissions are managed by administrators in Users → Roles. You cannot grant permissions to yourself.",
    ],
    troubleshooting: [
      "You can open a page but not act? You have the View permission but not the Create/Edit permission.",
      "You can't open the page at all? You are missing the module's View permission.",
      "You were recently granted access? Reload the page so the app picks up the new permissions.",
    ],
    relatedArticleIds: ["users-roles", "getting-started-navigation", "reports-generate"],
    route: "/users",
    permission: "users.view",
    status: "available",
    lastReviewed: "2026-01-01",
  },
];

/** Look up an article by id. */
export function getArticle(id: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.id === id);
}
