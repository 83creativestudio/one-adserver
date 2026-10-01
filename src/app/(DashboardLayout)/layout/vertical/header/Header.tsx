"use client";
import { useContext } from "react";
import { AppBar, Box, IconButton, Stack, Toolbar, Typography, useMediaQuery } from "@mui/material";
import { IconMenu2, IconMoon, IconSun } from "@tabler/icons-react";
import { CustomizerContext } from "@/app/context/customizerContext";
import Profile from "./Profile";

export default function Header(){
  const large=useMediaQuery((theme:any)=>theme.breakpoints.up("lg"));
  const {activeMode,setActiveMode,isCollapse,setIsCollapse,isMobileSidebar,setIsMobileSidebar}=useContext(CustomizerContext);
  return <AppBar position="sticky" color="inherit" elevation={0} sx={{borderBottom:"1px solid",borderColor:"divider",bgcolor:"background.paper"}}><Toolbar sx={{minHeight:70}}><IconButton aria-label="Toggle navigation" onClick={()=>large?setIsCollapse(isCollapse==="full-sidebar"?"mini-sidebar":"full-sidebar"):setIsMobileSidebar(!isMobileSidebar)}><IconMenu2 size={21}/></IconButton><Box flex={1} ml={1}><Typography fontWeight={700} color="text.primary">Ad operations</Typography></Box><Stack direction="row" alignItems="center" spacing={1}><IconButton aria-label="Toggle color mode" onClick={()=>setActiveMode(activeMode==="light"?"dark":"light")}>{activeMode==="light"?<IconMoon size={20}/>:<IconSun size={20}/>}</IconButton><Profile/></Stack></Toolbar></AppBar>;
}
