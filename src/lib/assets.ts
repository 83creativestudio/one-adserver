import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { db } from './store.ts';

const MAX_BYTES = 5 * 1024 * 1024;
export async function saveAsset(file: File) {
  if (!file.size || file.size > MAX_BYTES) throw new Error('Upload an image no larger than 5 MB');
  const bytes = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(bytes, { limitInputPixels: 16777216, failOn: 'error' }).metadata();
  const format = metadata.format;
  if (!format || !['png','jpeg','gif','webp'].includes(format)) throw new Error('Use a JPG, PNG, GIF or WebP image');
  const pages = metadata.pages || 1;
  const frameHeight = metadata.pageHeight || metadata.height || 0;
  if (!metadata.width || !frameHeight || metadata.width > 4096 || frameHeight > 4096) throw new Error('Image dimensions must be no larger than 4096 × 4096');
  if (pages > 100 || metadata.width * frameHeight * pages > 16777216) throw new Error('Animation has too many frames or pixels');
  const image = sharp(bytes, { animated: format === 'gif', limitInputPixels: 16777216, failOn: 'error' });
  const extension = format === 'jpeg' ? 'jpg' : format;
  const output = format === 'jpeg' ? image.rotate().jpeg({ quality: 90 }) : format === 'png' ? image.rotate().png() : format === 'gif' ? image.gif({ effort: 5 }) : image.rotate().webp({ quality: 90 });
  const {data,info} = await output.toBuffer({resolveWithObject:true});
  if (data.length > 10 * 1024 * 1024) throw new Error('Processed image is too large');
  const id = randomUUID();
  const storedName = `${id}.${extension}`;
  const directory = resolve(process.env.UPLOAD_DIR || 'data/uploads');
  await mkdir(directory,{recursive:true});
  const path = resolve(directory,storedName);
  await writeFile(path,data,{flag:'wx',mode:0o640});
  try {
    await db().prepare('INSERT INTO assets (id,original_name,stored_name,content_type,width,height,byte_size,created_at) VALUES (?,?,?,?,?,?,?,?)').run(id,basename(file.name).slice(0,255),storedName,format === 'jpeg' ? 'image/jpeg' : `image/${format}`,info.width,format === 'gif' ? frameHeight : info.height,data.length,new Date().toISOString());
  } catch (error) { await unlink(path); throw error; }
  return {id,image_url:`/api/assets/${id}`,width:info.width,height:format === 'gif' ? frameHeight : info.height,byte_size:data.length};
}

export async function readAsset(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  const row = await db().prepare('SELECT * FROM assets WHERE id=?').get(id);
  if (!row || basename(row.stored_name) !== row.stored_name) return null;
  try { return {bytes: await readFile(resolve(process.env.UPLOAD_DIR || 'data/uploads',row.stored_name)),contentType:row.content_type}; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
