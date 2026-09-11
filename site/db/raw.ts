import { env } from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('STORAGE_UNAVAILABLE');return env.DB;}
