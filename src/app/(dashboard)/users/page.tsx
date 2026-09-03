"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Eye, Edit, Trash2, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";

type UserRow = { id:string; full_name:string; phone:string|null; is_active:boolean; last_login_at:string|null; created_at:string; roles:string[] };

export default function UsersPage(){
  const [loading,setLoading]=React.useState(true);
  const [q,setQ]=React.useState("");
  const [users,setUsers]=React.useState<UserRow[]>([]);
  const [roles,setRoles]=React.useState<any[]>([]);
  const [show,setShow]=React.useState(false);
  const [form,setForm]=React.useState({full_name:"", phone:"", role_id:"", branch_id:""});

  const fetchData=React.useCallback(async()=>{
    setLoading(true);
    const [ur, rr]=await Promise.all([fetch("/api/users").then(r=>r.json()), fetch("/api/roles").then(r=>r.json()).catch(()=>[])]);
    setUsers(Array.isArray(ur)?ur: (ur.data??[]));
    // roles fallback to supabase direct
    if(Array.isArray(rr)) setRoles(rr);
    else {
      // fetch roles via supabase client side fallback: get from /api may not exist, try direct
      try{
        const r2=await fetch("/api/settings"); const j2=await r2.json();
        // roles not in settings, leave empty
      }catch{}
    }
    setLoading(false);
  },[]);
  React.useEffect(()=>{ fetchData(); },[fetchData]);

  // fetch roles directly via supabase client if API missing
  React.useEffect(()=>{
    (async()=>{
      try{
        const { createBrowserClient } = await import("@/lib/supabase/client");
        const sb=createBrowserClient();
        const {data}=await sb.from("roles").select("id, name");
        if(data) setRoles(data);
      }catch{}
    })();
  },[]);

  const filtered=users.filter(u=> !q || u.full_name.toLowerCase().includes(q.toLowerCase()) || (u.phone ?? "").includes(q));

  const createUser=async()=>{
    const r=await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    const j=await r.json();
    if(!r.ok) alert(j.error); else { setShow(false); fetchData(); }
  };
  const toggleActive=async(u:UserRow)=>{
    await fetch("/api/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:u.id, is_active: !u.is_active})});
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold">Users</h1><p className="text-muted-foreground">Real profiles, roles, RLS enforced — server authoritative</p></div>
        <Button onClick={()=>setShow(true)}><Plus className="h-4 w-4 mr-2"/>Add User</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Users</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{users.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{users.filter(u=>u.is_active).length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Inactive</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-muted-foreground">{users.filter(u=>!u.is_active).length}</div></CardContent></Card>
      </div>
      <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search name/phone" value={q} onChange={e=>setQ(e.target.value)} className="pl-9"/></div></CardContent></Card>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-6 space-y-3">{[...Array(5)].map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
        : filtered.length===0 ? <div className="py-12 text-center text-muted-foreground">No users — create your first team member</div>
        : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Phone</TableHead><TableHead>Roles</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
          {filtered.map(u=>(
            <TableRow key={u.id}><TableCell><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarFallback>{u.full_name.split(" ").map(n=>n[0]).join("").slice(0,2)}</AvatarFallback></Avatar><span className="font-medium">{u.full_name}</span></div></TableCell><TableCell>{u.phone ?? "—"}</TableCell><TableCell>{u.roles.length? u.roles.map(r=><Badge key={r} variant="secondary" className="mr-1">{r}</Badge>) : <Badge variant="outline">No role</Badge>}</TableCell><TableCell><Badge variant={u.is_active?"success":"secondary"}>{u.is_active?"active":"inactive"}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={()=>toggleActive(u)}><Shield className="h-4 w-4"/></Button></TableCell></TableRow>
          ))}
        </TableBody></Table></div>}
      </CardContent></Card>

      <Dialog open={show} onOpenChange={setShow}>
        <DialogContent><DialogHeader><DialogTitle>Add User</DialogTitle><DialogDescription>Creates profile + role assignment. Auth user via Supabase Auth email invite (outside V1 scope — creates profile placeholder).</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Full name *" value={form.full_name} onChange={e=>setForm({...form, full_name:e.target.value})}/>
            <Input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/>
            <Select value={form.role_id} onChange={e=>setForm({...form, role_id:e.target.value})}><option value="">Select role</option>{roles.map((r:any)=><option key={r.id} value={r.id}>{r.name}</option>)}</Select>
            <Button onClick={createUser} disabled={!form.full_name.trim()} className="w-full">Create</Button>
            <p className="text-xs text-muted-foreground">Server validates organization isolation, RLS, permission <code>users.manage</code>. Audit logged.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
