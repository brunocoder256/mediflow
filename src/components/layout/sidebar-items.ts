import {
  LayoutDashboard,
  ShoppingCart,
  Banknote,
  Package,
  Warehouse,
  Truck,
  Users,
  Receipt,
  RotateCcw,
  DollarSign,
  UserCircle,
  BarChart3,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  /** Translation key (see src/lib/i18n/dictionaries/en.ts → nav.*). */
  titleKey: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
}

export const navItems: NavItem[] = [
  {
    title: "Dashboard",
    titleKey: "nav.dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "POS",
    titleKey: "nav.pos",
    href: "/pos",
    icon: ShoppingCart,
  },
  {
    title: "Cash",
    titleKey: "nav.cash",
    href: "/cash",
    icon: Banknote,
  },
  {
    title: "Products",
    titleKey: "nav.products",
    href: "/products",
    icon: Package,
  },
  {
    title: "Inventory",
    titleKey: "nav.inventory",
    href: "/inventory",
    icon: Warehouse,
  },
  {
    title: "Purchases",
    titleKey: "nav.purchases",
    href: "/purchases",
    icon: Truck,
  },
  {
    title: "Suppliers",
    titleKey: "nav.suppliers",
    href: "/suppliers",
    icon: Users,
  },
  {
    title: "Sales",
    titleKey: "nav.sales",
    href: "/sales",
    icon: Receipt,
  },
  {
    title: "Returns",
    titleKey: "nav.returns",
    href: "/returns",
    icon: RotateCcw,
  },
  {
    title: "Expenses",
    titleKey: "nav.expenses",
    href: "/expenses",
    icon: DollarSign,
  },
  {
    title: "Customers",
    titleKey: "nav.customers",
    href: "/customers",
    icon: UserCircle,
  },
  {
    title: "Reports",
    titleKey: "nav.reports",
    href: "/reports",
    icon: BarChart3,
  },
  {
    title: "Users",
    titleKey: "nav.users",
    href: "/users",
    icon: Users,
  },
  {
    title: "Audit",
    titleKey: "nav.audit",
    href: "/audit",
    icon: FileText,
  },
  {
    title: "Settings",
    titleKey: "nav.settings",
    href: "/settings",
    icon: Settings,
  },
];
