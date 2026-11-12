// Vercel API route for managing services
// Uses Vercel KV (Redis) for persistent storage across devices

import { kv } from '@vercel/kv';

// Simple password check (use environment variable in production)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const KV_KEY = 'mgb-dashboard:services';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const services = await kv.get(KV_KEY);
      if (services) {
        res.status(200).json(services);
      } else {
        // Return empty array if no services saved yet
        res.status(200).json([]);
      }
    } catch (error) {
      console.error('Error reading services:', error);
      res.status(500).json({ error: 'Failed to read services' });
    }
  } else if (req.method === 'POST' || req.method === 'PUT') {
    // Check password
    const authHeader = req.headers.authorization;
    const providedPassword = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    if (providedPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const services = req.body;
      if (!Array.isArray(services)) {
        return res.status(400).json({ error: 'Invalid services data' });
      }

      await kv.set(KV_KEY, services);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error writing services:', error);
      res.status(500).json({ error: 'Failed to save services' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
