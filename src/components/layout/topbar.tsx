"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
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
import { NotificationsMenu } from "./notifications-menu";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useBranch } from "@/hooks/branch-context";
import {
  Menu,
  User,
  Settings,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  ChevronsUpDown,
} from "lucide-react";

interface TopbarProps {
  onMenuClick: () => void;
  title?: string;
  children?: React.ReactNode;
}

export function Topbar({ onMenuClick, title, children }: TopbarProps) {
  const [user, setUser] = useState<{ name: string; email: string; avatar: string }>({
    name: "User",
    email: "",
    avatar: "",
  });
  const { isOnline, wasOffline } = useOnlineStatus();
  const { branches, currentBranchId, defaultBranchId, setCurrentBranch } = useBranch();

  const currentBranch = branches.find((b) => b.id === currentBranchId) ?? null;

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.assign("/auth/login");
  };

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          name: data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "User",
          email: data.user.email || "",
          avatar: data.user.user_metadata?.avatar_url || "",
        });
      }
    });
  }, []);

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
        {/* Branch Selector — only authorized branches */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="hidden sm:flex items-center gap-2 h-9"
              title="Switch branch"
            >
              <span className="text-muted-foreground text-sm">Branch:</span>
              <span className="font-medium text-sm">
                {currentBranch ? currentBranch.name : defaultBranchId ? "Select branch" : "—"}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuLabel>Authorized branches</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {branches.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No branch access</div>
            ) : (
              branches.map((b) => (
                <DropdownMenuItem key={b.id} onClick={() => setCurrentBranch(b.id)}>
                  <span className="flex-1">{b.name}</span>
                  <span className="text-xs text-muted-foreground">{b.code}</span>
                  {b.id === currentBranchId && <CheckCircle2 className="ml-2 h-4 w-4 text-green-600" />}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Online/Offline Status — real server-reachability based */}
        <div className="flex items-center gap-2" title={isOnline ? "Server reachable — online" : "Server unreachable — offline"}>
          {isOnline ? (
            <div className="flex items-center gap-1 text-green-600">
              <Wifi className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">{wasOffline ? "Back online" : "Online"}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-red-600">
              <WifiOff className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Offline</span>
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            </div>
          )}
          {wasOffline && isOnline && (
            <span className="text-xs text-green-700 animate-pulse sm:hidden" aria-hidden>Reconnected</span>
          )}
        </div>

        {/* Notifications — real, live from the database */}
        <NotificationsMenu />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => window.location.assign("/users")}>
              <User className="mr-2 h-4 w-4" />
              <span>My account & team</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => window.location.assign("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onSelect={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}