"use client";
import { useState } from "react";
import { Avatar, IconButton, Menu, MenuItem, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
export default function Profile(){
  const[anchor,setAnchor]=useState<HTMLElement|null>(null);const router=useRouter();
  const logout=async()=>{await fetch("/api/auth/logout",{method:"POST"});setAnchor(null);router.push("/login");router.refresh()};
  return <><IconButton aria-label="Account menu" onClick={e=>setAnchor(e.currentTarget)}><Avatar sx={{width:34,height:34,bgcolor:"primary.main",fontSize:15}}>OA</Avatar></IconButton><Menu anchorEl={anchor} open={!!anchor} onClose={()=>setAnchor(null)}><Typography sx={{px:2,py:1,fontWeight:700}}>ONE. Adserver admin</Typography><MenuItem onClick={logout}>Sign out</MenuItem></Menu></>;
}
