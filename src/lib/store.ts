import { randomUUID } from "node:crypto";
import { createDatabase, type Database, type Transaction } from "../../database/index.mjs";

export type Resource = "advertisers" | "properties" | "placements" | "campaigns" | "creatives";
export const resources: Resource[] = ["advertisers", "properties", "placements", "campaigns", "creatives"];
const databaseGlobal = globalThis as typeof globalThis & { oneAdserverDb?: Database };

export function db() {
  return databaseGlobal.oneAdserverDb ??= createDatabase();
}

const fields: Record<Resource, string[]> = {
  advertisers: ["name", "contact_email"],
  properties: ["name", "kind", "domain"],
  placements: ["property_id", "name", "width", "height"],
  campaigns: ["advertiser_id", "name", "status", "start_at", "end_at", "daily_cap", "priority", "pacing"],
  creatives: ["campaign_id", "name", "image_url", "target_url", "width", "height"],
};

export async function list(resource: Resource) {
  const rows = await db().prepare(`SELECT * FROM ${resource} ORDER BY created_at DESC`).all();
  if (resource !== 'campaigns') return rows;
  const links = await db().prepare('SELECT campaign_id,placement_id FROM campaign_placements').all();
  return rows.map(row => ({...row, placement_ids: links.filter(link => link.campaign_id === row.id).map(link => link.placement_id)}));
}

async function savePlacements(tx: Transaction, campaignId: string, value: unknown) {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string') || value.length > 1000) throw new Error('Choose valid placements');
  const ids = [...new Set(value as string[])];
  for (const id of ids) if (!await tx.prepare('SELECT id FROM placements WHERE id=?').get(id)) throw new Error('A selected placement no longer exists');
  await tx.prepare('DELETE FROM campaign_placements WHERE campaign_id=?').run(campaignId);
  for (const id of ids) await tx.prepare('INSERT INTO campaign_placements (campaign_id,placement_id) VALUES (?,?)').run(campaignId,id);
}

export async function create(resource: Resource, input: Record<string, unknown>) {
  const allowed = fields[resource];
  const values = allowed.map((field) => input[field] ?? defaultValue(field));
  validate(resource, Object.fromEntries(allowed.map((field, i) => [field, values[i]])));
  const id = randomUUID();
  const created_at = new Date().toISOString();
  return db().transaction(async tx => {
    await tx.prepare(`INSERT INTO ${resource} (id, ${allowed.join(", ")}, created_at) VALUES (${["?", ...allowed.map(() => "?"), "?"].join(", ")})`).run(id, ...values as (string | number)[], created_at);
    if (resource === 'campaigns') await savePlacements(tx,id,input.placement_ids ?? []);
    return tx.prepare(`SELECT * FROM ${resource} WHERE id=?`).get(id);
  });
}

export async function update(resource: Resource, id: string, input: Record<string, unknown>) {
  const allowed = fields[resource].filter((field) => Object.hasOwn(input, field));
  if (!allowed.length && !(resource === 'campaigns' && 'placement_ids' in input)) throw new Error("No editable fields supplied");
  return db().transaction(async tx => {
    const current = await tx.prepare(`SELECT * FROM ${resource} WHERE id=?${tx.provider === 'mariadb' ? ' FOR UPDATE' : ''}`).get(id) as Record<string, unknown> | undefined;
    if (!current) return null;
    validate(resource, { ...current, ...input });
    if (allowed.length) await tx.prepare(`UPDATE ${resource} SET ${allowed.map((field) => `${field}=?`).join(", ")} WHERE id=?`).run(...allowed.map((field) => input[field]) as (string | number)[], id);
    if (resource === 'campaigns' && 'placement_ids' in input) await savePlacements(tx,id,input.placement_ids);
    return tx.prepare(`SELECT * FROM ${resource} WHERE id=?`).get(id);
  });
}

export async function remove(resource: Resource, id: string) {
  return (await db().prepare(`DELETE FROM ${resource} WHERE id=?`).run(id)).changes > 0;
}

function defaultValue(field: string): string | number {
  if (["width", "height", "daily_cap"].includes(field)) return 0;
  if (field === "priority") return 5;
  if (field === "pacing") return "asap";
  if (field === "status") return "active";
  if (field === "kind") return "website";
  return "";
}

function validate(resource: Resource, data: Record<string, unknown>) {
  for (const field of fields[resource]) {
    if (["width", "height", "daily_cap", "priority"].includes(field)) continue;
    if (typeof data[field] !== "string") throw new Error(`${field} must be text`);
    const max = field.endsWith("_id") ? 36 : field.endsWith("_url") ? 2048 : field.endsWith("_at") ? 10 : 255;
    if (String(data[field]).length > max) throw new Error(`${field} must be at most ${max} characters`);
  }
  if (!String(data.name || "").trim()) throw new Error("Name is required");
  for (const field of ["width", "height", "daily_cap", "priority"]) {
    if (field in data && (!Number.isInteger(Number(data[field])) || Number(data[field]) > 2147483647 || Number(data[field]) < (field === "priority" ? 1 : 0))) throw new Error(`${field} must be a valid number`);
  }
  if (resource === "placements" || resource === "creatives") {
    if (Number(data.width) < 1 || Number(data.height) < 1) throw new Error("Width and height must be positive");
  }
  if (resource === "properties" && !["website", "app"].includes(String(data.kind))) throw new Error("Invalid property type");
  if (resource === "campaigns") {
    if (!["asap", "even"].includes(String(data.pacing))) throw new Error("Invalid pacing");
    for (const field of ["start_at", "end_at"]) if (data[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(String(data[field])) || !Number.isFinite(Date.parse(String(data[field]))) || new Date(String(data[field])).toISOString().slice(0,10) !== data[field])) throw new Error("Invalid campaign date");
    if (!["active", "paused"].includes(String(data.status))) throw new Error("Invalid campaign status");
    if (Number(data.priority) > 10) throw new Error("Priority must be between 1 and 10");
    if (data.start_at && data.end_at && String(data.start_at) > String(data.end_at)) throw new Error("End date must follow start date");
  }
  if (resource === "creatives") {
    for (const field of ["image_url", "target_url"]) {
      const value = String(data[field] || "");
      if (!value) throw new Error(`${field} is required`);
      if (field === "image_url" && /^\/api\/assets\/[a-f0-9-]{36}$/.test(value)) continue;
      let url; try { url = new URL(value); } catch { throw new Error(`${field} must be an absolute http(s) URL`); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(`${field} must be an http(s) URL without credentials`);
    }
  }
}

export async function metrics() {
  const counts = Object.fromEntries(await Promise.all(resources.map(async (resource) => [resource, (await db().prepare(`SELECT COUNT(*) AS value FROM ${resource}`).get() as {value:number}).value])));
  const events = await db().prepare("SELECT kind, COUNT(*) AS value FROM events GROUP BY kind").all() as {kind:string;value:number}[];
  const totals = Object.fromEntries(events.map((row) => [row.kind, row.value]));
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const daily = await db().prepare("SELECT substr(occurred_at,1,10) AS day, kind, COUNT(*) AS value FROM events WHERE occurred_at >= ? GROUP BY day, kind ORDER BY day").all(since);
  const campaigns = await db().prepare("SELECT c.id,c.name,c.status,a.name AS advertiser,COALESCE(SUM(CASE WHEN e.kind='impression' THEN 1 ELSE 0 END),0) AS impressions,COALESCE(SUM(CASE WHEN e.kind='click' THEN 1 ELSE 0 END),0) AS clicks FROM campaigns c JOIN advertisers a ON a.id=c.advertiser_id LEFT JOIN events e ON e.campaign_id=c.id GROUP BY c.id,c.name,c.status,a.name ORDER BY impressions DESC LIMIT 8").all();
  const noFill = (await db().prepare("SELECT COUNT(*) AS value FROM delivery_requests WHERE outcome='empty'").get())?.value || 0;
  return { counts, totals, daily, campaigns, noFill };
}

export async function logEvent(kind: "request" | "impression" | "click", creativeId: string, campaignId: string, placementId: string) {
  await db().prepare("INSERT INTO events (id,creative_id,campaign_id,placement_id,kind,occurred_at) VALUES (?,?,?,?,?,?)").run(randomUUID(), creativeId, campaignId, placementId, kind, new Date().toISOString());
}
