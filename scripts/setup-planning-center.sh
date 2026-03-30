#!/bin/bash

# Planning Center Integration Setup Script
# This script helps you configure your Planning Center API credentials

echo "======================================"
echo "Planning Center Integration Setup"
echo "======================================"
echo ""

echo "To set up Planning Center integration, you need:"
echo "1. A Planning Center account"
echo "2. API credentials (App ID and Secret)"
echo ""
echo "Get your credentials at: https://api.planningcenteronline.com/oauth/applications"
echo ""
echo "Press Enter when you're ready to continue..."
read

echo ""
echo "Enter your Planning Center Application ID:"
read PC_APP_ID

echo ""
echo "Enter your Planning Center Secret:"
read -s PC_SECRET
echo ""

echo ""
echo "Setting up Supabase Edge Function secrets..."
echo ""

# Set the secrets in Supabase
supabase secrets set PLANNING_CENTER_APP_ID="$PC_APP_ID"
supabase secrets set PLANNING_CENTER_SECRET="$PC_SECRET"

echo ""
echo "✅ Planning Center credentials configured!"
echo ""
echo "Next steps:"
echo "1. Deploy the edge function: supabase functions deploy planning-center-lookup"
echo "2. Test the integration in your prayer form"
echo ""
