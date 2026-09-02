"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";
import {
  Menu,
  Bell,
  RefreshCw,
  User,
  Settings,
  LogOut,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface TopbarProps {
  onMenuClick: () => void;
  title?: string;
  children?: React.ReactNode;
}

export function Topbar({ onMenuClick, title, children }: TopbarProps) {
  const [syncStatus, setSyncStatus] = React.useState<"synced" | "syncing" | "error">("synced");
  const [notificationCount] = React.useState(3);

  return (
    <header className="flex h-14 items-center border-b bg-card px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
        {title && (
          <h1 className="text-lg font-semibold">{title}</h1>
        )}
        {children}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Branch Selector Placeholder */}
        <div className="hidden sm:flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
          <span className="text-muted-foreground">Branch:</span>
          <span className="font-medium">Main Store</span>
        </div>

        {/* Sync Status */}
        <div className="flex items-center gap-2">
          {syncStatus === "synced" && (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Synced</span>
            </div>
          )}
          {syncStatus === "syncing" && (
            <div className="flex items-center gap-1 text-blue-600">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-xs hidden sm:inline">Syncing</span>
            </div>
          )}
          {syncStatus === "error" && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Sync Error</span>
            </div>
          )}
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {notificationCount}
            </Badge>
          )}
        </Button>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src="/avatars/user.jpg" alt="User" />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">Admin User</p>
                <p className="text-xs text-muted-foreground">admin@mediflow.com</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}