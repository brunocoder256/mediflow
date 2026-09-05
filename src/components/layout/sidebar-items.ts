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
  href: string;
  icon: LucideIcon;
  badge?: string | number;
}

export const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "POS",
    href: "/pos",
    icon: ShoppingCart,
  },
  {
    title: "Cash",
    href: "/cash",
    icon: Banknote,
  },
  {
    title: "Products",
    href: "/products",
    icon: Package,
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Warehouse,
  },
  {
    title: "Purchases",
    href: "/purchases",
    icon: Truck,
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    icon: Users,
  },
  {
    title: "Sales",
    href: "/sales",
    icon: Receipt,
  },
  {
    title: "Returns",
    href: "/returns",
    icon: RotateCcw,
  },
  {
    title: "Expenses",
    href: "/expenses",
    icon: DollarSign,
  },
  {
    title: "Customers",
    href: "/customers",
    icon: UserCircle,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
  {
    title: "Users",
    href: "/users",
    icon: Users,
  },
  {
    title: "Audit",
    href: "/audit",
    icon: FileText,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];