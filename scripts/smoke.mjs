import sharp from 'sharp';
const base = process.env.SMOKE_BASE || "http://127.0.0.1:3107";
const password = process.env.SMOKE_PASSWORD;
const username = process.env.SMOKE_USERNAME || 'admin';
if (!password) throw new Error("Set SMOKE_PASSWORD");
const login = await fetch(`${base}/api/auth/login`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});
if (!login.ok) throw new Error(`Login failed: ${login.status}`);
const cookie = login.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("Missing session cookie");
const created = [];
async function post(resource, body) {
  const response = await fetch(`${base}/api/admin/${resource}`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify(body)});
  const data = await response.json();
  if (!response.ok) throw new Error(`${resource}: ${JSON.stringify(data)}`);
  created.push([resource,data.item.id]);return data.item;
}
try {
  const advertiser=await post("advertisers",{name:"Smoke test advertiser",contact_email:"test@example.com"});
  const property=await post("properties",{name:"Smoke test site",kind:"website",domain:"example.com"});
  const placement=await post("placements",{name:"Test banner",property_id:property.id,width:300,height:250});
  const campaign=await post("campaigns",{name:"Test campaign",advertiser_id:advertiser.id,status:"active",start_at:"",end_at:"",daily_cap:0,priority:5,placement_ids:[placement.id]});
  const bytes=await sharp({create:{width:300,height:250,channels:3,background:'#7755ff'}}).png().toBuffer();
  const form=new FormData();form.set('file',new File([bytes],'test.png',{type:'image/png'}));
  const upload=await fetch(`${base}/api/admin/assets`,{method:'POST',headers:{Cookie:cookie},body:form});
  const asset=(await upload.json()).asset;
  if(!upload.ok||!asset)throw new Error('Upload failed');
  const image=await fetch(`${base}${asset.image_url}`);
  if(!image.ok||image.headers.get('content-type')!=='image/png')throw new Error('Uploaded image not accessible');
  await post("creatives",{name:"Test creative",campaign_id:campaign.id,image_url:asset.image_url,target_url:"https://example.com/landing",width:300,height:250});
  const edit=await fetch(`${base}/api/admin/campaigns/${campaign.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({name:'Edited campaign'})});
  if(!edit.ok)throw new Error('Edit failed');
  const serving=await fetch(`${base}/api/serve?placement=${placement.id}`);
  const served=await serving.json();
  if(!serving.ok||!served.ad?.clickUrl)throw new Error(`Serve failed: ${JSON.stringify(served)}`);
  const impression=await fetch(served.ad.impressionUrl);
  if(impression.status!==200||impression.headers.get("content-type")!=="image/gif")throw new Error("Impression failed");
  const click=await fetch(served.ad.clickUrl,{redirect:"manual"});
  if(click.status!==302||click.headers.get("location")!=="https://example.com/landing")throw new Error("Click failed");
  const metrics=await fetch(`${base}/api/admin/metrics`,{headers:{Cookie:cookie}}).then(r=>r.json());
  if((metrics.totals.impression||0)<1||(metrics.totals.click||0)<1)throw new Error("Metrics did not update");
  const denied=await fetch(`${base}/api/admin/metrics`);
  if(denied.status!==401)throw new Error("Admin access check failed");
  await fetch(served.ad.impressionUrl);await fetch(served.ad.clickUrl,{redirect:'manual'});
  const repeated=await fetch(`${base}/api/admin/metrics`,{headers:{Cookie:cookie}}).then(r=>r.json());
  if(repeated.totals.impression!==metrics.totals.impression||repeated.totals.click!==metrics.totals.click)throw new Error('Duplicate tracking counted');
  console.log("PASS: login, CRUD/edit, upload/image retrieval, ad selection, impression/click deduplication, metrics, and admin access");
} finally {
  for(const [resource,id] of created.reverse()) await fetch(`${base}/api/admin/${resource}/${id}`,{method:"DELETE",headers:{Cookie:cookie}});
  await fetch(`${base}/api/auth/logout`,{method:'POST',headers:{Cookie:cookie}});
  if((await fetch(`${base}/api/admin/metrics`,{headers:{Cookie:cookie}})).status!==401)throw new Error('Logout did not revoke session');
}
