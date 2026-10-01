"use client";
import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { IconPlus, IconTrash, IconCopy } from "@tabler/icons-react";

type Row = Record<string, string | number>;
type Field = {key:string;label:string;type?:string;required?:boolean;options?:{value:string;label:string}[];help?:string};
const definitions: Record<string,{title:string;description:string;singular:string;fields:Field[];columns:string[]}> = {
  advertisers:{title:"Advertisers",description:"Companies whose campaigns run across your inventory.",singular:"advertiser",fields:[{key:"name",label:"Company name",required:true},{key:"contact_email",label:"Contact email",type:"email"}],columns:["name","contact_email"]},
  properties:{title:"Websites & apps",description:"The digital properties where you can show ads.",singular:"property",fields:[{key:"name",label:"Property name",required:true},{key:"kind",label:"Type",required:true,options:[{value:"website",label:"Website"},{value:"app",label:"App"}]},{key:"domain",label:"Domain or app ID"}],columns:["name","kind","domain"]},
  placements:{title:"Placements",description:"Ad spaces within a website or app. Copy a tag to start serving.",singular:"placement",fields:[{key:"name",label:"Placement name",required:true},{key:"property_id",label:"Website or app",required:true,options:[]},{key:"width",label:"Width (px)",type:"number",required:true},{key:"height",label:"Height (px)",type:"number",required:true}],columns:["name","property_id","width","height"]},
  campaigns:{title:"Campaigns",description:"Set flight dates, delivery priority and a daily impression limit.",singular:"campaign",fields:[{key:"name",label:"Campaign name",required:true},{key:"advertiser_id",label:"Advertiser",required:true,options:[]},{key:"status",label:"Status",required:true,options:[{value:"active",label:"Active"},{value:"paused",label:"Paused"}]},{key:"start_at",label:"Start date",type:"date"},{key:"end_at",label:"End date",type:"date"},{key:"daily_cap",label:"Daily impression cap (0 = unlimited)",type:"number"},{key:"priority",label:"Priority (1–10)",type:"number"}],columns:["name","advertiser_id","status","start_at","end_at","daily_cap"]},
  creatives:{title:"Creatives",description:"Image ads for your campaigns. Match creative and placement dimensions.",singular:"creative",fields:[{key:"name",label:"Creative name",required:true},{key:"campaign_id",label:"Campaign",required:true,options:[]},{key:"image_url",label:"Image URL",required:true},{key:"target_url",label:"Destination URL",required:true},{key:"width",label:"Width (px)",type:"number",required:true},{key:"height",label:"Height (px)",type:"number",required:true}],columns:["name","campaign_id","width","height","target_url"]},
};
const initial:Record<string,unknown>={kind:"website",status:"active",daily_cap:0,priority:5,width:300,height:250};

export default function ResourcePage({section}:{section:string}) {
  const definition=definitions[section];
  const [rows,setRows]=useState<Row[]>([]);
  const [lookups,setLookups]=useState<Record<string,Row[]>>({});
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState<Record<string,unknown>>(initial);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const lookupResource=section==="placements"?"properties":section==="campaigns"?"advertisers":section==="creatives"?"campaigns":"";
  const load=async()=>{
    const response=await fetch(`/api/admin/${section}`);
    if (!response.ok) {setError("Could not load data");return;}
    setRows((await response.json()).items);
    if(lookupResource){const lookup=await fetch(`/api/admin/${lookupResource}`);if(lookup.ok){const lookupRows=(await lookup.json()).items;setLookups((prev)=>({...prev,[lookupResource]:lookupRows}));}}
  };
  useEffect(()=>{if(definition)void load();},[section]); // eslint-disable-line react-hooks/exhaustive-deps
  const fields=useMemo(()=>definition?.fields.map((field)=>{
    if(field.key==="property_id")return {...field,options:(lookups.properties||[]).map((row)=>({value:String(row.id),label:String(row.name)}))};
    if(field.key==="advertiser_id")return {...field,options:(lookups.advertisers||[]).map((row)=>({value:String(row.id),label:String(row.name)}))};
    if(field.key==="campaign_id")return {...field,options:(lookups.campaigns||[]).map((row)=>({value:String(row.id),label:String(row.name)}))};
    return field;
  }),[definition,lookups]);
  if(!definition)return <Alert severity="error">Section not found</Alert>;
  const lookupLabel=(key:string,value:string|number)=>{
    const resource=key==="property_id"?"properties":key.replace("_id","")+"s";
    return lookups[resource]?.find((item)=>item.id===value)?.name || value;
  };
  const save=async()=>{
    setBusy(true);setError("");
    try{
      const payload=Object.fromEntries(Object.entries(form).map(([key,value])=>[key,["width","height","daily_cap","priority"].includes(key)?Number(value):value]));
      const response=await fetch(`/api/admin/${section}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Could not save");
      setOpen(false);setForm(initial);setNotice(`${definition.singular[0].toUpperCase()+definition.singular.slice(1)} created`);await load();
    }catch(e){setError(e instanceof Error?e.message:"Could not save");}finally{setBusy(false);}
  };
  const del=async(row:Row)=>{
    if(!window.confirm(`Delete ${row.name}? Related records will also be deleted.`))return;
    const response=await fetch(`/api/admin/${section}/${row.id}`,{method:"DELETE"});
    if(response.ok){setNotice("Deleted");await load();}else setError("Could not delete record");
  };
  const toggle=async(row:Row)=>{
    const status=row.status==="active"?"paused":"active";
    const response=await fetch(`/api/admin/campaigns/${row.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});
    if(response.ok){setNotice(`Campaign ${status}`);await load();}else setError("Could not update campaign");
  };
  const copy=async(row:Row)=>{
    const tag=`<div data-one-placement="${row.id}"></div><script async src="${window.location.origin}/ad.js"></script>`;
    await navigator.clipboard.writeText(tag);setNotice("Website tag copied");
  };
  return <Box sx={{py:3}}>
    <Stack direction={{xs:"column",sm:"row"}} justifyContent="space-between" alignItems={{sm:"center"}} spacing={2} mb={3}>
      <Box><Typography variant="h4" fontWeight={800}>{definition.title}</Typography><Typography color="text.secondary" mt={.5}>{definition.description}</Typography></Box>
      <Button variant="contained" startIcon={<IconPlus size={18}/>} onClick={()=>{setError("");setOpen(true)}}>New {definition.singular}</Button>
    </Stack>
    {error&&!open&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}
    <Card elevation={0} sx={{border:"1px solid",borderColor:"divider",borderRadius:3}}><CardContent sx={{p:0,"&:last-child":{pb:0}}}>
      <TableContainer><Table sx={{minWidth:660}}><TableHead><TableRow>{definition.columns.map((column)=><TableCell key={column} sx={{fontWeight:700,textTransform:"capitalize"}}>{column.replaceAll("_"," ")}</TableCell>)}<TableCell align="right" sx={{fontWeight:700}}>Actions</TableCell></TableRow></TableHead>
      <TableBody>{rows.length?rows.map((row)=><TableRow key={String(row.id)} hover>{definition.columns.map((column)=><TableCell key={column} sx={{maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{column==="status"?<Chip size="small" label={String(row[column])} color={row[column]==="active"?"success":"default"}/>:column.endsWith("_id")?lookupLabel(column,row[column]):column==="width"?`${row.width} × ${row.height}`:column==="height"?"":String(row[column]??"—")}</TableCell>)}<TableCell align="right" sx={{whiteSpace:"nowrap"}}>{section==="placements"&&<Button size="small" startIcon={<IconCopy size={16}/>} onClick={()=>copy(row)}>Tag</Button>}{section==="campaigns"&&<Button size="small" onClick={()=>toggle(row)}>{row.status==="active"?"Pause":"Resume"}</Button>}<Button color="error" size="small" aria-label={`Delete ${row.name}`} onClick={()=>del(row)}><IconTrash size={17}/></Button></TableCell></TableRow>):<TableRow><TableCell colSpan={definition.columns.length+1} align="center" sx={{py:9,color:"text.secondary"}}>No {definition.title.toLowerCase()} yet. Create your first {definition.singular} to get started.</TableCell></TableRow>}</TableBody></Table></TableContainer>
    </CardContent></Card>
    <Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="sm"><DialogTitle fontWeight={800}>New {definition.singular}</DialogTitle><DialogContent><Stack spacing={2.5} sx={{pt:1}}>{fields?.map((field)=>field.options?<FormControl fullWidth key={field.key} required={field.required}><InputLabel>{field.label}</InputLabel><Select label={field.label} value={String(form[field.key]??"")} onChange={(event)=>setForm({...form,[field.key]:event.target.value})}>{field.options.map((option)=><MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}</Select></FormControl>:<TextField key={field.key} fullWidth required={field.required} label={field.label} type={field.type||"text"} value={form[field.key]??""} onChange={(event)=>setForm({...form,[field.key]:event.target.value})} slotProps={field.type==="date"?{inputLabel:{shrink:true}}:undefined}/>)}</Stack>{error&&<Alert severity="error" sx={{mt:2}}>{error}</Alert>}</DialogContent><DialogActions sx={{p:2.5}}><Button onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy} variant="contained" onClick={save}>Create</Button></DialogActions></Dialog>
    <Snackbar open={!!notice} autoHideDuration={3500} onClose={()=>setNotice("")} message={notice}/>
  </Box>;
}
