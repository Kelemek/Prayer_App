#!/bin/bash
# Deployment script for all Supabase Edge Functions

set -e  # Exit on error

echo "🚀 Deploying Supabase Edge Functions"
echo "====================================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not installed"
    echo ""
    echo "Install with:"
    echo "  npm install -g supabase"
    echo ""
    exit 1
fi

echo "✅ Supabase CLI found: $(supabase --version)"
echo ""

# Parse command line arguments
FUNCTION_NAME="${1:-all}"

deploy_function() {
    local func_name=$1
    local flags=$2
    
    echo "📦 Deploying $func_name..."
    if supabase functions deploy "$func_name" $flags; then
        echo "✅ $func_name deployed successfully!"
        echo ""
    else
        echo "❌ Failed to deploy $func_name"
        return 1
    fi
}

# Deploy based on argument
case $FUNCTION_NAME in
    "send-notification")
        deploy_function "send-notification" "--no-verify-jwt"
        echo "� Remember: send-notification runs without JWT verification"
        echo "   This is for anonymous email sending (prayer requests, etc.)"
        ;;
    "send-prayer-reminders")
        deploy_function "send-prayer-reminders" ""
        echo "💡 Daily invoke: Supabase pg_cron (invoke-send-prayer-reminders, 10:00 UTC) + Vault (project_url + service_role_key). See docs/SETUP.md."
        echo "💡 Next steps:"
        echo "   1. Configure reminder interval in Admin Settings"
        echo "   2. Test with 'Send Reminders Now' button"
        ;;
    "send-user-hourly-prayer-reminders")
        deploy_function "send-user-hourly-prayer-reminders" ""
        echo "💡 Hourly invoke: Supabase pg_cron + Vault (project_url + service_role_key); set APP_URL on the function. See docs/SETUP.md."
        ;;
    "send-user-hourly-memorization-reminders")
        deploy_function "send-user-hourly-memorization-reminders" ""
        echo "💡 Hourly invoke: Supabase pg_cron + Vault (project_url + service_role_key); set APP_URL on the function. See docs/SETUP.md."
        ;;
    "transcribe-audio")
        deploy_function "transcribe-audio" ""
        echo "📋 Required secret: OPENAI_API_KEY"
        ;;
    "submit-feedback")
        deploy_function "submit-feedback" ""
        echo "📋 Required secret: NOTION_TOKEN"
        echo "📋 Optional secret: NOTION_FEEDBACK_DATA_SOURCE_ID (defaults to Prayer App Biz Feedback ad60c0ea-da0e-4a36-be18-b395c7bcb564)"
        echo "💡 JWT required (verify_jwt=true). Authenticated members submit in-app feedback to Notion."
        ;;
    "delete-account")
        deploy_function "delete-account" ""
        echo "💡 JWT required (verify_jwt=true). Settings account erasure; requires migration erase_user_account applied."
        echo "📋 Optional: STRIPE_SECRET_KEY (Pro customer cleanup), POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID"
        ;;
    "get-openai-org-usage")
        deploy_function "get-openai-org-usage" ""
        echo "📋 Optional secret: OPENAI_ADMIN_KEY (org-wide spend in admin UI)"
        ;;
    "cleanup-device-tokens")
        deploy_function "cleanup-device-tokens" ""
        echo "💡 Daily invoke: Supabase pg_cron (invoke-cleanup-device-tokens, 03:00 UTC) + Vault. See docs/SETUP.md."
        ;;
    "stripe-church-checkout")
        deploy_function "stripe-church-checkout" ""
        echo "📋 Secrets: STRIPE_SECRET_KEY, STRIPE_CHURCH_PRICE_ID, APP_URL, SUPABASE_*"
        ;;
    "stripe-pro-checkout")
        deploy_function "stripe-pro-checkout" ""
        echo "📋 Secrets: STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID, APP_URL, SUPABASE_*"
        ;;
    "stripe-billing-portal")
        deploy_function "stripe-billing-portal" ""
        echo "📋 Secrets: STRIPE_SECRET_KEY, APP_URL (optional STRIPE_PORTAL_CONFIGURATION_ID)"
        ;;
    "stripe-webhook")
        deploy_function "stripe-webhook" "--no-verify-jwt"
        echo "💡 Stripe Dashboard webhook → …/functions/v1/stripe-webhook (no JWT)"
        echo "📋 Secrets: STRIPE_WEBHOOK_SECRET, SUPABASE_*"
        ;;
    "send-billing-signup-email")
        deploy_function "send-billing-signup-email" ""
        echo "📋 Secrets: STRIPE_SECRET_KEY, STRIPE_CHURCH_PRICE_ID, STRIPE_PRO_PRICE_ID, APP_URL, SUPABASE_*"
        echo "💡 Optional: STRIPE_CHURCH_PRICE_DISPLAY, STRIPE_PRO_PRICE_DISPLAY"
        ;;
    "reconcile-church-billing")
        deploy_function "reconcile-church-billing" "--no-verify-jwt"
        echo "💡 Hourly invoke: pg_cron job invoke-reconcile-church-billing + Vault. See docs/SETUP.md."
        ;;
    "send-verification-code")
        deploy_function "send-verification-code" "--no-verify-jwt"
        echo "💡 Remember: send-verification-code runs without JWT verification"
        echo "   This is for email verification before prayer/preference submissions"
        echo ""
        echo "📋 Required environment variables:"
        echo "   - RESEND_API_KEY"
        echo "   - RESEND_FROM_EMAIL"
        echo "   - SUPABASE_URL"
        echo "   - SUPABASE_SERVICE_ROLE_KEY (platform name; value = secret API key, auto-set when hosted)"
        ;;
    "send-email")
        deploy_function "send-email" "--no-verify-jwt"
        echo "💡 send-email must allow non-user JWT: it is invoked from other Edge Functions"
        echo "   (send-verification-code, send-prayer-reminders, etc.) with the admin Supabase client."
        echo "   Also invoked from the Angular app; protect abuse via app logic and RLS elsewhere."
        echo ""
        echo "📋 Secrets: RESEND_API_KEY, MAIL_SENDER_ADDRESS, MAIL_FROM_NAME (optional), SUPABASE_*"
        ;;
    "email-unsubscribe")
        deploy_function "email-unsubscribe" "--no-verify-jwt"
        echo "💡 Public one-click / GET unsubscribe; uses admin client (SUPABASE_SERVICE_ROLE_KEY = Secret key) to set is_active = false."
        echo "   Set APP_URL for friendly redirects/copy. List-Unsubscribe POST targets this function URL."
        ;;
    "trigger-email-processor")
        deploy_function "trigger-email-processor" "--no-verify-jwt"
        echo "💡 Processes email_queue via Resend; invoked from Angular after approvals."
        ;;
    "all")
        echo "Deploying all functions..."
        echo ""
        deploy_function "send-notification" "--no-verify-jwt"
        deploy_function "send-email" "--no-verify-jwt"
        deploy_function "email-unsubscribe" "--no-verify-jwt"
        deploy_function "trigger-email-processor" "--no-verify-jwt"
        deploy_function "send-verification-code" "--no-verify-jwt"
        deploy_function "send-prayer-reminders" ""
        deploy_function "send-user-hourly-prayer-reminders" ""
        deploy_function "send-user-hourly-memorization-reminders" ""
        deploy_function "transcribe-audio" ""
        deploy_function "submit-feedback" ""
        deploy_function "delete-account" ""
        deploy_function "get-openai-org-usage" ""
        deploy_function "cleanup-device-tokens" ""
        deploy_function "stripe-church-checkout" ""
        deploy_function "stripe-pro-checkout" ""
        deploy_function "stripe-billing-portal" ""
        deploy_function "stripe-webhook" "--no-verify-jwt"
        deploy_function "reconcile-church-billing" "--no-verify-jwt"
        deploy_function "send-billing-signup-email" ""
        echo "🎉 All functions deployed successfully!"
        ;;
    *)
        echo "❌ Unknown function: $FUNCTION_NAME"
        echo ""
        echo "Usage: ./deploy-functions.sh [function-name]"
        echo ""
        echo "Available functions:"
        echo "  send-notification        - Email sending (no JWT)"
        echo "  send-email               - Resend email API (no JWT; called from app + other functions)"
        echo "  email-unsubscribe        - Public unsubscribe (no JWT; token in URL/body)"
        echo "  trigger-email-processor  - Drain email_queue via Resend (no JWT)"
        echo "  send-verification-code   - Email verification codes (no JWT)"
        echo "  send-prayer-reminders    - Automated prayer reminders"
        echo "  send-user-hourly-prayer-reminders - User hourly self-reminders (cron)"
        echo "  send-user-hourly-memorization-reminders - User hourly memorization reminders (cron)"
        echo "  transcribe-audio              - Memorization Recite Whisper STT (JWT)"
        echo "  submit-feedback               - In-app feedback to Notion (JWT; NOTION_TOKEN)"
        echo "  delete-account                - Settings account erasure (JWT; service role RPC)"
        echo "  get-openai-org-usage          - OpenAI org spend for admin UI"
        echo "  cleanup-device-tokens    - Stale device tokens + push log cleanup (cron)"
        echo "  stripe-church-checkout   - Church Stripe Checkout (JWT)"
        echo "  stripe-pro-checkout      - Pro Stripe Checkout (JWT)"
        echo "  stripe-billing-portal    - Stripe Customer Portal for churches (JWT)"
        echo "  stripe-webhook           - Stripe webhooks (no JWT)"
        echo "  reconcile-church-billing - Hourly grace/period-end downgrades (no JWT; cron)"
        echo "  send-billing-signup-email - Native tour signup emails (JWT; platform From)"
        echo "  all                      - Deploy all functions (default)"
        echo ""
        exit 1
        ;;
esac

echo ""
echo "✨ Deployment complete!"
echo ""
