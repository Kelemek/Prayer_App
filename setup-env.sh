#!/bin/bash

# Environment Setup Script for Angular Prayer App
# This script helps you set up your .env file

echo "🙏 Angular Prayer App - Environment Setup"
echo "=========================================="
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled. Your existing .env file was not modified."
        exit 0
    fi
fi

# Create .env from template
if [ ! -f ".env.example" ]; then
    echo "❌ Error: .env.example file not found!"
    exit 1
fi

cp .env.example .env
echo "✅ Created .env file from template"
echo ""

# Prompt for Supabase credentials
echo "📝 Please provide your Supabase credentials:"
echo "(You can find these in your Supabase Dashboard → Settings → API)"
echo ""

read -p "Enter your SUPABASE_URL: " SUPABASE_URL
read -p "Enter your SUPABASE_PUBLISHABLE_KEY: " SUPABASE_PUBLISHABLE_KEY

# Update .env file
if [ -n "$SUPABASE_URL" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=$SUPABASE_URL|" .env
    else
        # Linux
        sed -i "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=$SUPABASE_URL|" .env
    fi
    echo "✅ Updated VITE_SUPABASE_URL"
fi

if [ -n "$SUPABASE_PUBLISHABLE_KEY" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|VITE_SUPABASE_PUBLISHABLE_KEY=.*|VITE_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY|" .env
    else
        # Linux
        sed -i "s|VITE_SUPABASE_PUBLISHABLE_KEY=.*|VITE_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY|" .env
    fi
    echo "✅ Updated VITE_SUPABASE_PUBLISHABLE_KEY"
fi

echo ""
echo "✨ Environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Review your .env file: cat .env"
echo "2. Start the dev server: npm run dev"
echo "3. Open http://localhost:4200/"
echo ""
echo "📚 For more help, see docs/ENV_SETUP_FIX.md"
