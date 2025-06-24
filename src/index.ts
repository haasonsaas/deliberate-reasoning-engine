#!/usr/bin/env node
import { DREServer } from './server.js';

async function main() {
  const server = new DREServer();
  
  try {
    await server.run();
  } catch (error) {
    console.error('Server error:', error);
    process.exit(1);
  }
}

main();