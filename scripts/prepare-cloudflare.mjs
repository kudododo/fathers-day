import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(ROOT_DIR, '.cloudflare/public');

const copyTargets = [
  'index.html',
  'shopify-handoff-dry-run.html',
  'create',
  'lp',
  'thanks',
  'styles',
  'src',
  'config',
];

async function ensureFreshOutputDir(){
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
}

async function copyTarget(target){
  const sourcePath = resolve(ROOT_DIR, target);
  const destinationPath = resolve(OUTPUT_DIR, target);
  await cp(sourcePath, destinationPath, { recursive: true });
}

async function removeKnownJunk(dirPath = OUTPUT_DIR){
  const entries = await readdir(dirPath, { withFileTypes: true });
  for(const entry of entries){
    const entryPath = resolve(dirPath, entry.name);
    if(entry.isDirectory()){
      await removeKnownJunk(entryPath);
      continue;
    }
    if(entry.name === '.DS_Store'){
      await rm(entryPath, { force: true });
    }
  }
}

async function main(){
  await ensureFreshOutputDir();
  for(const target of copyTargets){
    await copyTarget(target);
  }
  await removeKnownJunk();
  console.log(`Prepared Cloudflare static assets at ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error('Failed to prepare Cloudflare assets:', error);
  process.exitCode = 1;
});
