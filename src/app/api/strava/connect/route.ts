import { NextResponse } from 'next/server';
import { authorizeUrl } from '@/lib/strava';

export const GET = () => NextResponse.redirect(authorizeUrl());
