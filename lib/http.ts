import { NextResponse } from 'next/server';
export function apiError(error:unknown){const message=error instanceof Error?error.message:'Request failed';const status=message.includes('not configured')?503:message.includes('not found')?404:message.includes('Invalid washer transition')?409:400;return NextResponse.json({error:message},{status});}
export function requireBearer(request:Request,secret:string|undefined){return !!secret&&request.headers.get('authorization')===`Bearer ${secret}`;}
