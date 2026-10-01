import { createHmac, timingSafeEqual } from "node:crypto";

function secret(){return process.env.DELIVERY_SECRET || process.env.ADMIN_PASSWORD || (process.env.NODE_ENV==="development"?"local-development-only":"");}
export function signDelivery(creative:string,placement:string){
  const stamp=Math.floor(Date.now()/1000);
  const signature=createHmac("sha256",secret()).update(`${creative}:${placement}:${stamp}`).digest("hex");
  return `${stamp}.${signature}`;
}
export function verifyDelivery(creative:string,placement:string,token:string){
  if(!secret())return false;
  const [stampText,signature]=token.split(".");
  const stamp=Number(stampText);
  if(!Number.isInteger(stamp)||stamp>Math.floor(Date.now()/1000)+60||stamp<Math.floor(Date.now()/1000)-86400||!signature)return false;
  const expected=createHmac("sha256",secret()).update(`${creative}:${placement}:${stamp}`).digest("hex");
  return signature.length===expected.length&&timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
}
