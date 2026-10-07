"use client";
import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { IconPlus, IconTrash, IconEdit, IconCode, IconUpload } from '@tabler/icons-react';

type Row = Record<string, any>;
type Field = {key:string;label:string;type?:string;required?:boolean;reference?:string;multiple?:boolean;options?:string[];help?:string};
type Definition = {title:string;description:string;singular:string;fields:Field[];columns:string[]};
const definitions:Record<string,Definition> = {
  advertisers:{title:'Advertisers',description:'Companies whose campaigns run across your inventory.',singular:'advertiser',fields:[{key:'name',label:'Company name',required:true},{key:'contact_email',label:'Contact email',type:'email'}],columns:['name','contact_email']},
  properties:{title:'Websites & apps',description:'The digital properties where your ads appear.',singular:'property',fields:[{key:'name',label:'Property name',required:true},{key:'kind',label:'Type',options:['website','app'],required:true},{key:'domain',label:'Domain or app ID'}],columns:['name','kind','domain']},
  placements:{title:'Placements',description:'Define ad spaces and get website tags or app integration URLs.',singular:'placement',fields:[{key:'name',label:'Placement name',required:true},{key:'property_id',label:'Website or app',reference:'properties',required:true},{key:'width',label:'Width (px)',type:'number',required:true},{key:'height',label:'Height (px)',type:'number',required:true}],columns:['name','property_id','dimensions']},
  campaigns:{title:'Campaigns',description:'Choose exactly where each campaign runs, and control its delivery.',singular:'campaign',fields:[{key:'name',label:'Campaign name',required:true},{key:'advertiser_id',label:'Advertiser',reference:'advertisers',required:true},{key:'status',label:'Status',options:['active','paused'],required:true},{key:'placement_ids',label:'Allowed placements',reference:'placements',multiple:true,help:'A campaign without placements will not serve.'},{key:'start_at',label:'Start date (UTC)',type:'date'},{key:'end_at',label:'End date (UTC)',type:'date'},{key:'daily_cap',label:'Daily impressions (0 = unlimited)',type:'number'},{key:'pacing',label:'Delivery pacing',options:['asap','even'],help:'Even spreads a capped campaign across each UTC day.'},{key:'priority',label:'Priority (1–10)',type:'number'}],columns:['name','advertiser_id','status','placement_ids','daily_cap']},
  creatives:{title:'Creatives',description:'Upload and preview your image ads, or use an existing image URL.',singular:'creative',fields:[{key:'name',label:'Creative name',required:true},{key:'campaign_id',label:'Campaign',reference:'campaigns',required:true},{key:'image_url',label:'Image URL',required:true},{key:'target_url',label:'Destination URL',type:'url',required:true},{key:'width',label:'Width (px)',type:'number',required:true},{key:'height',label:'Height (px)',type:'number',required:true}],columns:['preview','name','campaign_id','dimensions']},
};
const defaults:Row={kind:'website',status:'paused',daily_cap:0,priority:5,width:300,height:250,placement_ids:[],pacing:'asap'};
const labels:Record<string,string>={property_id:'Website or app',advertiser_id:'Advertiser',campaign_id:'Campaign',contact_email:'Contact email',placement_ids:'Placements',daily_cap:'Daily limit',dimensions:'Size',preview:'Preview'};

async function api(url:string,options?:RequestInit) {
  const response=await fetch(url,options);
  const data=await response.json();
  if(response.status===401){window.location.assign('/login');throw new Error('Please sign in again');}
  if(!response.ok)throw new Error(data.error||'Request failed');
  return data;
}

export default function ResourcePage({section}:{section:string}) {
  const definition=definitions[section];
  const [rows,setRows]=useState<Row[]>([]), [lookups,setLookups]=useState<Record<string,Row[]>>({});
  const [form,setForm]=useState<Row>({}), [editing,setEditing]=useState<string|null>(null), [open,setOpen]=useState(false);
  const [search,setSearch]=useState(''), [error,setError]=useState(''), [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false), [loading,setLoading]=useState(true), [uploading,setUploading]=useState(false);
  const [deleting,setDeleting]=useState<Row|null>(null), [integration,setIntegration]=useState<Row|null>(null);
  const load=useCallback(async()=>{
    if(!definition)return;
    setLoading(true);
    try {
      const references=[...new Set(definition.fields.flatMap(field=>field.reference?[field.reference]:[]))];
      const [data,...related]=await Promise.all([api(`/api/admin/${section}`),...references.map(ref=>api(`/api/admin/${ref}`))]);
      setRows(data.items);setLookups(Object.fromEntries(references.map((ref,index)=>[ref,related[index].items])));
    } catch(e){setError(e instanceof Error?e.message:'Could not load data');}finally{setLoading(false);}
  },[definition,section]);
  useEffect(()=>{setSearch('');setError('');void load();},[load]);
  if(!definition)return <Alert severity="error">Section not found</Alert>;

  const begin=(row?:Row)=>{
    setEditing(row?.id||null);
    setForm(Object.fromEntries(definition.fields.map(field=>[field.key,row?.[field.key]??defaults[field.key]??''])));
    setError('');setOpen(true);
  };
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');
    try {
      const payload=Object.fromEntries(definition.fields.map(field=>[field.key,field.type==='number'?Number(form[field.key]):form[field.key]]));
      await api(`/api/admin/${section}${editing?`/${editing}`:''}`,{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      setOpen(false);setNotice(editing?'Changes saved':`${definition.singular} created`);await load();
    }catch(e){setError(e instanceof Error?e.message:'Could not save');}finally{setBusy(false);}
  };
  const upload=async(file?:File)=>{
    if(!file)return;setUploading(true);setError('');
    try {const body=new FormData();body.set('file',file);const {asset}=await api('/api/admin/assets',{method:'POST',body});setForm(previous=>({...previous,image_url:asset.image_url,width:asset.width,height:asset.height}));}
    catch(e){setError(e instanceof Error?e.message:'Upload failed');}finally{setUploading(false);}
  };
  const remove=async()=>{
    if(!deleting)return;setBusy(true);
    try{await api(`/api/admin/${section}/${deleting.id}`,{method:'DELETE'});setDeleting(null);setNotice('Record deleted');await load();}catch(e){setError(e instanceof Error?e.message:'Delete failed');}finally{setBusy(false);}
  };
  const toggle=async(row:Row)=>{
    try{await api(`/api/admin/campaigns/${row.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:row.status==='active'?'paused':'active'})});await load();}catch(e){setError(e instanceof Error?e.message:'Update failed');}
  };
  const referenceLabel=(key:string,id:string)=>{
    const ref=definition.fields.find(field=>field.key===key)?.reference;
    return (ref?lookups[ref]?.find(row=>row.id===id)?.name:null)||id;
  };
  const filtered=rows.filter(row=>definition.columns.some(key=>String(key.endsWith('_id')?referenceLabel(key,row[key]):row[key]??'').toLowerCase().includes(search.toLowerCase())));
  const origin=typeof window!=='undefined'?window.location.origin:'';
  const tag=integration?`<div data-one-placement="${integration.id}"></div>\n<script async src="${origin}/ad.js"></script>`:'';
  const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);setNotice('Copied');}catch{setNotice('Select and copy the text manually');}};

  return <Box sx={{py:3}}>
    <Stack direction={{xs:'column',sm:'row'}} justifyContent="space-between" gap={2} mb={3}><Box><Typography variant="h4" fontWeight={800}>{definition.title}</Typography><Typography color="text.secondary" mt={.5}>{definition.description}</Typography></Box><Button variant="contained" startIcon={<IconPlus size={18}/>} onClick={()=>begin()}>New {definition.singular}</Button></Stack>
    {error&&!open&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}
    <TextField label={`Search ${definition.title.toLowerCase()}`} value={search} onChange={event=>setSearch(event.target.value)} size="small" sx={{mb:2,minWidth:280,maxWidth:'100%'}}/>
    <Card elevation={0} sx={{border:'1px solid',borderColor:'divider',borderRadius:3}}><TableContainer><Table sx={{minWidth:700}}><TableHead><TableRow>{definition.columns.map(column=><TableCell key={column} sx={{fontWeight:700,textTransform:'capitalize'}}>{labels[column]||column}</TableCell>)}<TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
      {filtered.map(row=><TableRow key={row.id} hover>{definition.columns.map(column=><TableCell key={column} sx={{maxWidth:260,overflowWrap:'anywhere'}}>{column==='preview'?<Box component="img" src={row.image_url} alt={row.name} sx={{width:80,height:60,objectFit:'contain',bgcolor:'action.hover',borderRadius:1}}/>:column==='dimensions'?`${row.width} × ${row.height}`:column==='status'?<Chip size="small" label={row.status} color={row.status==='active'?'success':'default'}/>:column==='placement_ids'?<Chip size="small" color={row.placement_ids?.length?'default':'warning'} label={row.placement_ids?.length?`${row.placement_ids.length} assigned`:'Not assigned'}/>:column.endsWith('_id')?referenceLabel(column,row[column]):column==='daily_cap'&&!row[column]?'Unlimited':String(row[column]||'—')}</TableCell>)}<TableCell align="right" sx={{whiteSpace:'nowrap'}}>{section==='placements'&&<Button size="small" aria-label={`Integration for ${row.name}`} onClick={()=>setIntegration(row)}><IconCode size={18}/></Button>}{section==='campaigns'&&<Button size="small" onClick={()=>toggle(row)}>{row.status==='active'?'Pause':'Resume'}</Button>}<Button size="small" aria-label={`Edit ${row.name}`} onClick={()=>begin(row)}><IconEdit size={18}/></Button><Button size="small" color="error" aria-label={`Delete ${row.name}`} onClick={()=>{setError('');setDeleting(row)}}><IconTrash size={18}/></Button></TableCell></TableRow>)}
      {!filtered.length&&<TableRow><TableCell colSpan={definition.columns.length+1} align="center" sx={{py:7}}>{loading?'Loading…':search?'No matching records.':`No ${definition.title.toLowerCase()} yet.`}</TableCell></TableRow>}
    </TableBody></Table></TableContainer></Card>
    <Dialog open={open} onClose={()=>!busy&&!uploading&&setOpen(false)} fullWidth maxWidth="sm"><Box component="form" onSubmit={save}><DialogTitle fontWeight={800}>{editing?'Edit':'New'} {definition.singular}</DialogTitle><DialogContent><Stack spacing={2.5} sx={{pt:1}}>
      {section==='creatives'&&<Box><Button component="label" variant="outlined" disabled={uploading} startIcon={<IconUpload size={18}/>}>{uploading?'Uploading…':'Upload image'}<input hidden type="file" accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp" onChange={event=>{void upload(event.target.files?.[0]);event.target.value=''}}/></Button><Typography variant="body2" color="text.secondary" mt={1}>JPG, PNG, GIF (including animation) or WebP. Maximum 5 MB, 4096 × 4096 pixels per frame.</Typography>{form.image_url&&<Box component="img" src={form.image_url} alt="Creative preview" sx={{mt:2,width:'100%',maxHeight:200,objectFit:'contain',bgcolor:'action.hover'}}/>}</Box>}
      {definition.fields.map(field=>field.reference||field.options?<FormControl key={field.key} fullWidth required={field.required}><InputLabel>{field.label}</InputLabel><Select label={field.label} multiple={field.multiple} value={form[field.key]??(field.multiple?[]:'')} onChange={event=>setForm({...form,[field.key]:event.target.value})}>{(field.reference?lookups[field.reference]||[]:(field.options||[]).map(value=>({id:value,name:value==='asap'?'As soon as possible':value==='even'?'Even through the day':value}))).map((row:Row)=><MenuItem key={row.id} value={row.id}>{row.name}{field.reference==='placements'?` (${row.width} × ${row.height})`:''}</MenuItem>)}</Select>{field.help&&<Typography variant="caption" color="text.secondary" mt={.5}>{field.help}</Typography>}{field.reference&&!lookups[field.reference]?.length&&<Alert severity="info" sx={{mt:1}}>Create a record in {field.reference} first.</Alert>}</FormControl>:<TextField key={field.key} label={field.label} required={field.required} type={field.type||'text'} value={form[field.key]??''} onChange={event=>setForm({...form,[field.key]:event.target.value})} fullWidth slotProps={{...(field.type==='date'?{inputLabel:{shrink:true}}:{}),htmlInput:field.type==='number'?{min:field.key==='daily_cap'?0:1,max:field.key==='priority'?10:2147483647,step:1}:{maxLength:field.key.endsWith('_url')?2048:255}}}/>)}</Stack>{error&&<Alert severity="error" sx={{mt:2}}>{error}</Alert>}</DialogContent><DialogActions sx={{p:2.5}}><Button onClick={()=>setOpen(false)} disabled={busy||uploading}>Cancel</Button><Button type="submit" variant="contained" disabled={busy||uploading}>{busy?'Saving…':editing?'Save changes':'Create'}</Button></DialogActions></Box></Dialog>
    <Dialog open={!!deleting} onClose={()=>!busy&&setDeleting(null)}><DialogTitle>Delete {deleting?.name}?</DialogTitle><DialogContent>Related inventory records will also be deleted. Historical delivery totals are retained.{error&&<Alert severity="error" sx={{mt:2}}>{error}</Alert>}</DialogContent><DialogActions><Button onClick={()=>setDeleting(null)} disabled={busy}>Cancel</Button><Button color="error" onClick={remove} disabled={busy}>Delete</Button></DialogActions></Dialog>
    <Dialog open={!!integration} onClose={()=>setIntegration(null)} fullWidth maxWidth="sm"><DialogTitle>Integrate {integration?.name}</DialogTitle><DialogContent><Stack spacing={2}><Typography>Website tag</Typography><TextField multiline value={tag} slotProps={{input:{readOnly:true}}}/><Button onClick={()=>copy(tag)}>Copy tag</Button><Typography>App delivery endpoint</Typography><TextField value={`${origin}/api/serve?placement=${integration?.id||''}`} slotProps={{input:{readOnly:true}}}/><Typography color="text.secondary">Render the returned image, call its impression URL after it loads, and open its click URL on a tap. Each response represents one display; request a new ad for each display.</Typography></Stack></DialogContent><DialogActions><Button onClick={()=>setIntegration(null)}>Close</Button></DialogActions></Dialog>
    <Snackbar open={!!notice} autoHideDuration={4000} onClose={()=>setNotice('')} message={notice}/>
  </Box>;
}
