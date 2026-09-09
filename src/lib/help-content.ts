// In-app help content for the Mediflow IQ Help dialog.
// Mirrors docs/help.md (keep the tutorial links in sync with that file).

export interface HelpVideo {
  label: string;
  url: string;
}

export const HELP_VIDEOS: HelpVideo[] = [
  { label: "Inventory Overview and its functionality", url: "https://youtu.be/RU2vbLwMAmA" },
  { label: "How to Add a Product", url: "https://youtu.be/rnhZQhNCVY0" },
  { label: "How to make sales with the POS feature", url: "https://youtu.be/OeWG1b6WSOM" },
  { label: "How to make a new Purchase", url: "https://youtu.be/fevsJVQSFK0" },
  { label: "How to use the Supplier Feature", url: "https://youtu.be/6Yaglpj_iy0" },
];

export interface HelpSection {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  tip?: string;
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting started & navigation",
    summary: "Mediflow IQ is a pharmacy/inventory management system. Use the left sidebar to move between modules and the top bar for branch, online/offline status, notifications and your account.",
    bullets: [
      "The sidebar lists every module: Dashboard, POS, Cash, Products, Inventory, Purchases, Suppliers, Sales, Returns, Expenses, Customers, Reports, Users, Audit and Settings.",
      "Top bar: pick the branch you are working in, watch the live online/offline indicator, check the notification bell, open this Help (?), switch theme and open your account menu (logout).",
      "Work is saved as you go — nothing needs to be pressed to save. Every action is also recorded in the Audit log.",
    ],
    tip: "Always confirm the branch selector shows the store you are at — sales, stock and cash are tracked per branch.",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    summary: "Home screen with a live snapshot of the business.",
    bullets: [
      "Key figures: today's sales, low-stock and expiring products, pending approvals and recent activity.",
      "Click any card to jump straight to the relevant module.",
      "Trends and alerts (low stock, near expiry) update automatically.",
    ],
  },
  {
    id: "pos",
    title: "POS (sales counter)",
    summary: "Make a sale in seconds: scan or search the product, take payment, print the receipt.",
    bullets: [
      "Search/scan a product by name, generic, brand, SKU or barcode — press Ctrl+K to focus search, Enter to sell the highlighted line.",
      "Apply per-line discounts or a whole-sale discount before charging.",
      "Payment methods: Cash, Mobile Money, Card, Bank or Other. Cash sales need an open cash session (or the session is queued automatically).",
      "Split payment lets one sale be paid partly in cash and partly on mobile, card, etc.",
      "Use Hold to park a cart and continue with the next customer; resume it from Held baskets.",
      "After payment the receipt prints; you can also record customer details for the sale.",
    ],
    tip: "Offline? The sale is queued and auto-syncs when the connection returns — it still appears in Sales.",
  },
  {
    id: "cash",
    title: "Cash",
    summary: "Manage cash sessions, floats and cash movements for each drawer.",
    bullets: [
      "Open a cash session at the start of the day with an opening float; close it at the end with counted cash.",
      "Record cash-in/cash-out movements (withdrawals, petty cash, deposits) against the active session.",
      "The system reconciles expected vs counted cash and keeps a register history per drawer.",
      "Offline: session opens and movements queue and sync automatically.",
    ],
  },
  {
    id: "products",
    title: "Products",
    summary: "The product master — what you sell, how it is priced and stocked.",
    bullets: [
      "Add a product with name, category, selling unit, SKU/barcode, cost and selling prices, stock quantity and expiry.",
      "Keep categories and units organized; units are available offline too when adding a product.",
      "Search and filter the list, edit details, and see which supplier sells each product.",
      "Follow the How to Add a Product tutorial below for a walkthrough.",
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    summary: "Monitor stock levels, movements and expiries across the branch.",
    bullets: [
      "See stock on hand versus reorder levels; low-stock items are highlighted and raise notifications.",
      "Movements (purchases received, sales, returns, disposals, adjustments) are traced in and out.",
      "Track batches and expiry dates so expiring stock is flagged before it expires.",
      "Follow the Inventory Overview tutorial below for a walkthrough.",
    ],
  },
  {
    id: "purchases",
    title: "Purchases (purchase orders)",
    summary: "Order stock from suppliers, approve it, receive it into inventory and pay against it.",
    bullets: [
      "Create a purchase order: pick the supplier, add products (ordered quantities and unit cost), then save as a draft.",
      "Move the PO through its status flow (e.g. Ordered → Approved) to confirm it; this can be done offline too.",
      "Receive goods when they arrive — receiving puts the stock into inventory automatically (GRN).",
      "Record payments against the PO from the purchase detail page; the outstanding balance updates from real transactions.",
      "Cancel a PO if needed (only before it is received).",
      "Follow the How to make a new Purchase tutorial below for a walkthrough.",
    ],
    tip: "A PO stays in the Outstanding/supplier balance until paid, even before the goods are received.",
  },
  {
    id: "suppliers",
    title: "Suppliers",
    summary: "The supplier master with outstanding balances, payments and a full history per supplier.",
    bullets: [
      "Add suppliers, deactivate old ones, and see the outstanding (credit) balance for each.",
      "Outstanding = open purchase orders minus payments and returns — it includes POs you have ordered but not yet received.",
      "Open a supplier for its full detail: POs, goods received, payments, pricing, returns, credit approvals, notes and documents.",
      "Record a payment from the detail page (Cash, Mobile, Bank, Card, etc.) and the balance recalculates automatically.",
      "Request a credit-limit change for approval; small changes apply instantly, larger ones wait for approval.",
      "Follow the How to use the Supplier Feature tutorial below for a walkthrough.",
    ],
  },
  {
    id: "sales",
    title: "Sales",
    summary: "History of every completed transaction, with filters and exports.",
    bullets: [
      "Browse sales by date range, branch, payment method, status or search.",
      "Open a sale to view its items, payments and printed receipt.",
      "Raise a return from a sale when a customer brings stock back.",
    ],
  },
  {
    id: "returns",
    title: "Returns",
    summary: "Customer returns and purchase returns handled separately.",
    bullets: [
      "Customer returns credit the customer/sale back and put stock back on the shelf.",
      "Purchase returns send goods back to a supplier and reduce what you owe them.",
      "All returns follow an approval flow where required.",
    ],
  },
  {
    id: "expenses",
    title: "Expenses",
    summary: "Record and categorize money going out of the business.",
    bullets: [
      "Log expenses against a category and payment method, optionally linked to a cash session.",
      "Track returns on expenses and expense summaries per branch/period.",
      "Offline: new expenses queue and sync automatically when back online.",
    ],
  },
  {
    id: "customers",
    title: "Customers",
    summary: "Who you sell to — including walk-in sales.",
    bullets: [
      "Create and search customers (name, phone, email) and link them to sales.",
      "Walk-in/quick sales are recorded without creating a full customer record.",
      "Customer balances and credit notes appear on their profile. Offline records sync when online.",
    ],
  },
  {
    id: "reports",
    title: "Reports",
    summary: "Analytics and exports to run the business.",
    bullets: [
      "Sales, purchases, inventory and profitability reports by period and branch.",
      "Export any report to CSV, Excel, PDF, or print it directly.",
      "Report numbers are computed from real transactions — nothing is hardcoded.",
    ],
  },
  {
    id: "users-audit",
    title: "Users, roles & audit",
    summary: "Invite your team, control what they can do, and review every change.",
    bullets: [
      "Invite team members, assign roles (admin, manager, cashier, viewer) with the relevant permissions.",
      "The Audit log records who did what and when across the system.",
      "Keep access controlled per branch and per role.",
    ],
  },
  {
    id: "settings",
    title: "Settings",
    summary: "System preferences for your organization.",
    bullets: [
      "Set the default branch/currency, tax behaviour and other organization-wide options.",
      "Manage users, roles, permissions, system preferences and add-ons from Settings.",
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    summary: "The bell at the top tells you what needs attention.",
    bullets: [
      "Low-stock and expiring items raise alerts so you can reorder in time.",
      "Pending purchase approvals and queued offline work are surfaced here.",
      "Mark items as read (or mark all read) to keep the badge clean.",
    ],
  },
  {
    id: "offline",
    title: "Offline mode & auto-sync",
    summary: "Mediflow IQ keeps working without internet and catches up automatically.",
    bullets: [
      "When the top-bar indicator is red, you are offline. Everything you create is stored on this device and shown in the Pending panel.",
      "As soon as the connection returns, queued work syncs automatically in the background — no refresh needed.",
      "Sales, purchases (create/confirm/receive/pay), supplier payments, expenses, customers, products, returns and cash open/buildings all queue offline.",
      "If a queued item conflicts (e.g. a duplicate customer), it is flagged as failed for you to review instead of silently dropped.",
    ],
    tip: "Reports and lists keep showing your last-known data while offline, so you can keep working.",
  },
  {
    id: "video-tutorials",
    title: "Video tutorials",
    summary: "Short screen recordings that walk you through the key features.",
    bullets: [
      "Watch any tutorial below. Each video opens in a new tab so you do not lose your place.",
      "Covered: Inventory overview, adding a product, POS sales, creating a purchase and the supplier feature.",
    ],
  },
];