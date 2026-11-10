"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Card, CardContent, Chip, Grid, LinearProgress, Skeleton, Stack, Typography } from "@mui/material";
import { IconArrowUpRight, IconBolt, IconEye, IconClick, IconTargetArrow, IconWorld, IconChartBar } from "@tabler/icons-react";

type Metrics={counts:Record<string,number>;totals:Record<string,number>;daily:{day:string;kind:string;value:number}[];campaigns:{id:string;name:string;status:string;advertiser:string;impressions:number;clicks:number}[];generatedAt:string};
const cards=[{label:"Impressions",key:"impression",icon:IconEye,color:"#0074ba"},{label:"Clicks",key:"click",icon:IconClick,color:"#6b47d6"},{label:"Ad requests",key:"request",icon:IconBolt,color:"#e7982a"}];

export default function Dashboard(){
  const [data,setData]=useState<Metrics|null>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    let mounted=true;
    const load=()=>{
      if(document.visibilityState==='hidden')return;
      void fetch("/api/admin/metrics",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(result=>{if(mounted){setData(result);setError(false)}}).catch(()=>{if(mounted)setError(true)});
    };
    load();
    const timer=window.setInterval(load,30_000);
    document.addEventListener('visibilitychange',load);
    return ()=>{mounted=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',load)};
  },[]);
  const loading=!data&&!error;
  const totals=data?.totals||{};
  const ctr=totals.impression?((totals.click||0)/totals.impression*100).toFixed(2):"0.00";
  return <Box sx={{py:3}}>
    <Stack direction={{xs:"column",md:"row"}} justifyContent="space-between" alignItems={{md:"center"}} gap={2} mb={3}>
      <Box><Typography variant="h4" fontWeight={800}>Overview</Typography><Typography color="text.secondary" mt={.5}>Your inventory and campaign delivery at a glance.</Typography></Box>
      <Button component={Link} href="/campaigns" variant="contained" endIcon={<IconArrowUpRight size={17}/>}>Manage campaigns</Button>
    </Stack>
    {error&&<Alert severity="error" sx={{mb:2}}>Could not load the dashboard.</Alert>}
    {loading&&<LinearProgress sx={{mb:3}}/>}
    {data&&<Typography variant="caption" color="text.secondary" display="block" mb={2}>Updated {new Date(data.generatedAt).toLocaleString()} · Refreshes about every minute</Typography>}
    <Grid container spacing={2.5}>
      {cards.map(({label,key,icon:Icon,color})=><Grid key={key} size={{xs:12,sm:6,lg:3}}><Card elevation={0} sx={{border:"1px solid",borderColor:"divider",borderRadius:3,height:"100%"}}><CardContent sx={{p:3}}><Box sx={{width:42,height:42,borderRadius:2,bgcolor:`${color}18`,color,display:"grid",placeItems:"center",mb:2}}><Icon size={22}/></Box><Typography color="text.secondary" fontWeight={600}>{label}</Typography>{loading?<Skeleton variant="text" width={145} height={42}/>:<Typography sx={{fontSize:30,fontWeight:800,lineHeight:1.3}}>{data?(totals[key]||0).toLocaleString():'—'}</Typography>}</CardContent></Card></Grid>)}
      <Grid size={{xs:12,sm:6,lg:3}}><Card elevation={0} sx={{border:"1px solid",borderColor:"divider",borderRadius:3,height:"100%"}}><CardContent sx={{p:3}}><Box sx={{width:42,height:42,borderRadius:2,bgcolor:"#1aa88718",color:"#1aa887",display:"grid",placeItems:"center",mb:2}}><IconChartBar size={22}/></Box><Typography color="text.secondary" fontWeight={600}>Click-through rate</Typography>{loading?<Skeleton variant="text" width={100} height={42}/>:<Typography sx={{fontSize:30,fontWeight:800,lineHeight:1.3}}>{data?`${ctr}%`:'—'}</Typography>}</CardContent></Card></Grid>
      <Grid size={{xs:12,lg:8}}><Card elevation={0} sx={{border:"1px solid",borderColor:"divider",borderRadius:3,height:"100%"}}><CardContent sx={{p:3}}><Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}><Box><Typography variant="h6" fontWeight={800}>Campaign performance</Typography><Typography color="text.secondary">Lifetime impressions and clicks</Typography></Box><Button component={Link} href="/reports">View reports</Button></Stack>
      {loading?<Stack spacing={1}><Skeleton height={48}/><Skeleton height={48}/><Skeleton height={48}/></Stack>:data?.campaigns?.length?data.campaigns.slice(0,8).map((campaign)=><Box key={campaign.id} sx={{py:1.5,borderTop:"1px solid",borderColor:"divider"}}><Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}><Box><Typography fontWeight={700}>{campaign.name}</Typography><Typography variant="body2" color="text.secondary">{campaign.advertiser}</Typography></Box><Stack direction="row" spacing={2} alignItems="center"><Box textAlign="right"><Typography fontWeight={700}>{campaign.impressions.toLocaleString()}</Typography><Typography variant="caption" color="text.secondary">impressions</Typography></Box><Chip size="small" label={campaign.status} color={campaign.status==="active"?"success":"default"}/></Stack></Stack></Box>):<Box sx={{py:7,textAlign:"center"}}><Typography fontWeight={700}>{error&&!data?'Campaign data is unavailable.':'No campaigns yet'}</Typography>{!error&&<Typography color="text.secondary" mt={.5}>Create an advertiser, then a campaign and matching creative.</Typography>}</Box>}
      </CardContent></Card></Grid>
      <Grid size={{xs:12,lg:4}}><Card elevation={0} sx={{border:"1px solid",borderColor:"divider",borderRadius:3,height:"100%"}}><CardContent sx={{p:3}}><Typography variant="h6" fontWeight={800} mb={.5}>Ready to serve</Typography><Typography color="text.secondary" mb={3}>Set up your inventory in three steps.</Typography>
      {[{label:"Add a website or app",href:"/properties",count:data?.counts.properties,icon:IconWorld},{label:"Create a placement",href:"/placements",count:data?.counts.placements,icon:IconTargetArrow},{label:"Launch a campaign",href:"/campaigns",count:data?.counts.campaigns,icon:IconBolt}].map((item,index)=><Stack key={item.label} component={Link} href={item.href} direction="row" alignItems="center" spacing={1.5} sx={{textDecoration:"none",color:"text.primary",p:1.5,borderRadius:2,"&:hover":{bgcolor:"action.hover"}}}><Box sx={{width:34,height:34,borderRadius:2,bgcolor:"primary.light",color:"primary.main",display:"grid",placeItems:"center"}}><item.icon size={18}/></Box><Box flex={1}><Typography fontWeight={700}>{item.label}</Typography><Typography variant="caption" color="text.secondary">{loading?'Loading…':data?`${item.count??0} configured`:'Unavailable'}</Typography></Box><Typography color="text.secondary">0{index+1}</Typography></Stack>)}
      </CardContent></Card></Grid>
    </Grid>
  </Box>;
}
