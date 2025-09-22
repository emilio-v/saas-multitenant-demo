#!/bin/bash

# Database Reset Script for Multi-tenant SaaS Demo
# This script completely resets the PostgreSQL database

echo "🔄 Multi-tenant Database Reset Script"
echo "====================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL in your .env.local file"
    exit 1
fi

echo "⚠️  WARNING: This will completely reset your database!"
echo "   • All tenant data will be lost"
echo "   • All user data will be lost" 
echo "   • All project data will be lost"
echo ""

# Prompt for confirmation
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "🚫 Reset cancelled"
    exit 0
fi

echo ""
echo "🚀 Running TypeScript reset script..."

# Run the TypeScript reset script
bun run scripts/reset-db.ts

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Database reset completed!"
    echo "You can now start fresh with 'bun run dev'"
else
    echo ""
    echo "❌ Reset failed. Check the error messages above."
    exit 1
fi