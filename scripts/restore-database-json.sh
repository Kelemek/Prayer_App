#!/bin/bash

# Restore Database from JSON Backup
# This script restores a Supabase database from a JSON backup file

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}=== Supabase Database Restore Script (JSON) ===${NC}\n"
echo -e "${YELLOW}⚠️  WARNING: This will overwrite your current database!${NC}"
echo -e "${YELLOW}⚠️  Make sure you have a recent backup before proceeding.${NC}\n"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create a .env file with the following variables:"
    echo "  VITE_SUPABASE_URL=your_supabase_url"
    echo "  SUPABASE_SERVICE_KEY=your_service_key"
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Validate required variables
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo -e "${RED}Error: Missing required environment variables${NC}"
    echo "Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY in .env"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

# List available backups
echo -e "${BLUE}Available backups:${NC}\n"
if [ -d "backups" ] && [ "$(ls -A backups/*.json.gz 2>/dev/null)" ]; then
    ls -lh backups/*.json.gz | awk '{print $9, "(" $5 ")"}'
    echo ""
else
    echo "No JSON backups found in ./backups/"
    exit 1
fi

# Get backup file from user
read -p "Enter the backup file name (or full path): " BACKUP_INPUT

# Handle different input formats
if [ -f "$BACKUP_INPUT" ]; then
    BACKUP_FILE="$BACKUP_INPUT"
elif [ -f "backups/$BACKUP_INPUT" ]; then
    BACKUP_FILE="backups/$BACKUP_INPUT"
elif [ -f "backups/backup_${BACKUP_INPUT}.json.gz" ]; then
    BACKUP_FILE="backups/backup_${BACKUP_INPUT}.json.gz"
else
    echo -e "${RED}Error: Backup file not found: $BACKUP_INPUT${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Selected backup: $BACKUP_FILE${NC}"

# Final confirmation
read -p "$(echo -e ${RED}Are you sure you want to restore? This will OVERWRITE your database! [yes/NO]: ${NC})" CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
    echo -e "\n${YELLOW}Decompressing backup...${NC}"
    TEMP_JSON="/tmp/restore_temp_$(date +%s).json"
    gunzip -c "$BACKUP_FILE" > "$TEMP_JSON"
    JSON_FILE="$TEMP_JSON"
else
    JSON_FILE="$BACKUP_FILE"
fi

# Install dependencies if needed
if [ ! -d "node_modules/@supabase/supabase-js" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install @supabase/supabase-js
fi

# Create restore script
cat > /tmp/restore-script.js << 'EOFJS'
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function restoreDatabase() {
  const backupFile = process.argv[2];
  const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  console.log(`Restoring backup from: ${backup.timestamp}`);
  console.log('');

  const tables = Object.keys(backup.tables);
  
  for (const table of tables) {
    const tableData = backup.tables[table];
    
    if (tableData.error) {
      console.log(`⊘ Skipping ${table} (had error in backup)`);
      continue;
    }

    const records = tableData.data;
    
    if (!records || records.length === 0) {
      console.log(`⊘ Skipping ${table} (no data)`);
      continue;
    }

    try {
      console.log(`Restoring ${table} (${records.length} records)...`);
      
      // Delete existing records
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (deleteError && deleteError.code !== 'PGRST116') {
        console.error(`  Warning: Could not clear ${table}:`, deleteError.message);
      }

      // Insert records in batches of 100
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from(table)
          .insert(batch);
        
        if (insertError) {
          console.error(`  Error inserting batch ${i}-${i+batch.length}:`, insertError.message);
        }
      }

      console.log(`  ✓ Restored ${records.length} records to ${table}`);
    } catch (err) {
      console.error(`  ✗ Error restoring ${table}:`, err.message);
    }
  }

  console.log('\n✓ Restore complete!');
}

restoreDatabase().catch(err => {
  console.error('Restore failed:', err);
  process.exit(1);
});
EOFJS

# Perform restore
echo -e "${YELLOW}Starting restore...${NC}\n"

VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_KEY" \
node /tmp/restore-script.js "$JSON_FILE"

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✓ Database restored successfully!${NC}"
    
    # Cleanup temp files
    if [ -n "$TEMP_JSON" ] && [ -f "$TEMP_JSON" ]; then
        rm "$TEMP_JSON"
    fi
    rm /tmp/restore-script.js
else
    echo -e "\n${RED}✗ Restore failed${NC}"
    
    # Cleanup temp files
    if [ -n "$TEMP_JSON" ] && [ -f "$TEMP_JSON" ]; then
        rm "$TEMP_JSON"
    fi
    rm /tmp/restore-script.js
    exit 1
fi

echo -e "\n${GREEN}Restore complete!${NC}"
echo -e "${YELLOW}Note: You may need to refresh your application to see the changes.${NC}"
