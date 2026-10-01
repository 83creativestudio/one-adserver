"use client";
import Link from "next/link";
import { Box, Typography } from "@mui/material";

export default function Logo() {
  return <Box component={Link} href="/" sx={{height:70,display:"flex",alignItems:"center",gap:1.2,textDecoration:"none",color:"text.primary"}}>
    <Box sx={{width:32,height:32,borderRadius:2,bgcolor:"primary.main",color:"white",fontWeight:900,fontSize:20,display:"grid",placeItems:"center"}}>1</Box>
    <Typography sx={{fontWeight:800,fontSize:20,letterSpacing:"-.04em",whiteSpace:"nowrap"}}>ONE. <Box component="span" sx={{fontWeight:500}}>Adserver</Box></Typography>
  </Box>;
}
