// Vercel API route for managing services
// Stores services in a JSON file for persistence across devices

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const SERVICES_FILE = join(process.cwd(), 'data', 'services.json');

// Ensure data directory exists
async function ensureDataDir() {
  const { mkdir } = await import('fs/promises');
  try {
    await mkdir(join(process.cwd(), 'data'), { recursive: true });
  } catch (e) {
    // Directory already exists
  }
}

// Read services from file
async function readServices() {
  try {
    await ensureDataDir();
    const data = await readFile(SERVICES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    // File doesn't exist or is invalid, return null
    return null;
  }
}

// Write services to file
async function writeServices(services) {
  await ensureDataDir();
  await writeFile(SERVICES_FILE, JSON.stringify(services, null, 2), 'utf-8');
}

// Simple password check (use environment variable in production)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

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
      const services = await readServices();
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

      await writeServices(services);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error writing services:', error);
      res.status(500).json({ error: 'Failed to save services' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
