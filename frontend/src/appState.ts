export type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;

export function getBrowserStorage():StorageLike|null{
  try{return window.localStorage}catch{return null}
}

export function readJsonStorage<T>(storage:StorageLike|null,key:string,fallback:T,isValid?:(value:unknown)=>value is T):T{
  if(!storage) return fallback;
  try{
    const raw=storage.getItem(key);
    if(raw==null) return fallback;
    const parsed=JSON.parse(raw);
    if(isValid&&!isValid(parsed)) throw new Error('Invalid stored value');
    return parsed as T;
  }catch{
    try{storage.removeItem(key)}catch{/* Storage may be blocked; fallback is enough. */}
    return fallback;
  }
}

export function readTextStorage(storage:StorageLike|null,key:string,fallback=''):string{
  if(!storage) return fallback;
  try{return storage.getItem(key)??fallback}catch{return fallback}
}

export function writeTextStorage(storage:StorageLike|null,key:string,value:string){
  if(!storage) return;
  try{storage.setItem(key,value)}catch{/* Ignore quota/private-mode storage failures. */}
}

export function writeJsonStorage(storage:StorageLike|null,key:string,value:unknown){
  writeTextStorage(storage,key,JSON.stringify(value));
}

export function removeStorageItem(storage:StorageLike|null,key:string){
  if(!storage) return;
  try{storage.removeItem(key)}catch{/* Ignore storage access failures. */}
}

export function errorMessage(error:unknown){
  return error instanceof Error?error.message:'Unexpected error';
}

export async function parseJsonResponse<T>(response:Response,label:string):Promise<T>{
  const text=await response.text();
  if(!response.ok){
    const detail=text.trim();
    const status=[response.status,response.statusText].filter(Boolean).join(' ');
    throw new Error(`${label} failed${status?` (${status})`:''}${detail?`: ${detail}`:''}`);
  }
  if(!text.trim()) throw new Error(`${label} returned an empty response.`);
  try{return JSON.parse(text) as T}catch{throw new Error(`${label} returned invalid JSON.`)}
}

export async function fetchJson<T>(input:RequestInfo|URL,init:RequestInit|undefined,label:string,fetcher:typeof fetch=fetch):Promise<T>{
  let response:Response;
  try{response=await fetcher(input,init)}
  catch(error){throw new Error(`${label} could not reach the backend: ${errorMessage(error)}`,{cause:error})}
  return parseJsonResponse<T>(response,label);
}
