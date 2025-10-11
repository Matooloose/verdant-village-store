# Auto-Generating Promo Code System

## Overview
This system provides multiple ways to automatically generate and manage promo codes that change over time, perfect for dynamic marketing campaigns.

## Quick Setup

### 1. Database Setup
First, run the SQL scripts in your Supabase SQL editor:

```sql
-- Run promo_codes_table.sql first to create the table
-- Then run auto_promo_generator.sql for database functions
```

### 2. Frontend Integration
Import the utilities in your React components:

```typescript
import { createAutoPromo, generateTimeBasedCode, AUTO_PROMO_TEMPLATES } from '@/lib/promoUtils';
import { supabase } from '@/integrations/supabase/client';
```

## Usage Examples

### 1. Daily Auto-Changing Codes
Create codes that change every day:

```typescript
// Create a daily promo code
const dailyPromo = await createAutoPromo({
  type: 'daily',
  discountType: 'percentage',
  discountValue: 15,
  minOrderValue: 100
}, supabase);

console.log(`Today's code: ${dailyPromo}`); // DAILY1252025
```

### 2. Flash Sale Codes
Create limited-time flash sales:

```typescript
// 2-hour flash sale
const flashPromo = await createAutoPromo({
  type: 'flash',
  discountType: 'percentage',
  discountValue: 25,
  minOrderValue: 50,
  durationHours: 2
}, supabase);
```

### 3. Seasonal Campaigns
Auto-generate seasonal promotions:

```typescript
// Seasonal code (changes based on current season)
const seasonalPromo = await createAutoPromo({
  type: 'seasonal',
  discountType: 'percentage',
  discountValue: 20, // Will be overridden by seasonal settings
  minOrderValue: 75
}, supabase);
```

### 4. Weekly Rotating Codes
Codes that change every week:

```typescript
const weeklyPromo = await createAutoPromo({
  type: 'weekly',
  discountType: 'fixed',
  discountValue: 30,
  minOrderValue: 200
}, supabase);
```

## Database Functions Usage

### Auto-Generate Daily Codes
Use PostgreSQL functions for server-side generation:

```sql
-- Create today's promo code
SELECT create_daily_promo(15, 100);

-- Create weekly promo code
SELECT create_weekly_promo(20, 150);

-- Create flash sale (2 hours)
SELECT create_flash_sale(25, 50, 2);

-- Create seasonal code
SELECT create_seasonal_promo();
```

### Scheduled Generation
Set up automated code generation using PostgreSQL cron:

```sql
-- Install pg_cron extension first
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily code generation at midnight
SELECT cron.schedule('daily-promo', '0 0 * * *', 'SELECT create_daily_promo(15, 100);');

-- Schedule weekly codes every Monday
SELECT cron.schedule('weekly-promo', '0 0 * * 1', 'SELECT create_weekly_promo(20, 150);');
```

## Integration with Checkout

### In your Checkout component:

```typescript
import { createAutoPromo, generateTimeBasedCode } from '@/lib/promoUtils';

const CheckoutComponent = () => {
  const [currentDailyCode, setCurrentDailyCode] = useState<string>('');

  // Get today's code on component mount
  useEffect(() => {
    const todayCode = generateTimeBasedCode('daily');
    setCurrentDailyCode(todayCode);
  }, []);

  // Show current promo to users
  const displayCurrentPromo = () => {
    return (
      <div className="bg-green-100 p-4 rounded-lg mb-4">
        <h3 className="font-semibold text-green-800">Today's Special!</h3>
        <p className="text-green-700">
          Use code <strong>{currentDailyCode}</strong> for 15% off orders over R100
        </p>
      </div>
    );
  };

  return (
    <div>
      {displayCurrentPromo()}
      {/* Rest of checkout form */}
    </div>
  );
};
```

## Marketing Campaign Examples

### 1. Progressive Week Campaign
```typescript
// Monday - Weekend buildup
const progressiveWeek = async () => {
  const campaigns = [
    { day: 'Monday', discount: 10, code: 'WEEK_START' },
    { day: 'Wednesday', discount: 15, code: 'MIDWEEK_BOOST' },
    { day: 'Friday', discount: 20, code: 'WEEKEND_PREP' },
    { day: 'Sunday', discount: 25, code: 'WEEK_END_BLAST' }
  ];

  for (const campaign of campaigns) {
    await createAutoPromo({
      type: 'flash',
      discountType: 'percentage',
      discountValue: campaign.discount,
      durationHours: 24
    }, supabase);
  }
};
```

### 2. Seasonal Rotation
```typescript
// Auto-rotate based on seasons
const seasonalCampaign = async () => {
  return await createAutoPromo({
    type: 'seasonal',
    discountType: 'percentage',
    discountValue: 20, // Overridden by seasonal logic
    minOrderValue: 150
  }, supabase);
};
```

## Pre-configured Templates

Use the built-in templates for common scenarios:

```typescript
import { AUTO_PROMO_TEMPLATES } from '@/lib/promoUtils';

// Quick access to predefined campaigns
const templates = AUTO_PROMO_TEMPLATES;

// Create weekend special
const weekendSpecial = await createAutoPromo(templates.weekend_special, supabase);

// Create new customer discount
const newCustomer = await createAutoPromo(templates.new_customer, supabase);

// Create bulk order discount
const bulkOrder = await createAutoPromo(templates.bulk_order, supabase);
```

## Monitoring and Analytics

### Check Active Codes
```sql
-- See all active promo codes
SELECT * FROM promo_codes 
WHERE is_active = true 
AND (valid_until IS NULL OR valid_until > NOW());

-- Check usage statistics
SELECT 
  code,
  usage_count,
  max_uses,
  created_at,
  (max_uses - usage_count) as remaining_uses
FROM promo_codes 
WHERE usage_count > 0
ORDER BY usage_count DESC;
```

### Deactivate Expired Codes
```sql
-- Auto-deactivate expired codes
UPDATE promo_codes 
SET is_active = false 
WHERE valid_until < NOW() AND is_active = true;
```

## Production Setup Checklist

- [ ] Run `promo_codes_table.sql` in production database
- [ ] Run `auto_promo_generator.sql` in production database  
- [ ] Set up pg_cron for automated generation
- [ ] Configure daily/weekly generation schedules
- [ ] Set up monitoring for code usage
- [ ] Create cleanup job for expired codes
- [ ] Test all promo code templates
- [ ] Set up analytics tracking

## Security Notes

- Row Level Security (RLS) is enabled on the promo_codes table
- Only authenticated users can create codes
- Usage limits prevent abuse
- Automatic expiration prevents indefinite usage
- Audit trail tracks all code generations

## Troubleshooting

### Common Issues:

1. **"Code already exists" error**
   - The system generates unique codes, but for manual codes, ensure uniqueness
   - Daily codes are unique per day, weekly per week, etc.

2. **"Invalid promo code" in checkout**
   - Check if code is active: `is_active = true`
   - Verify expiration: `valid_until > NOW()`
   - Check usage limits: `usage_count < max_uses`

3. **Database function errors**
   - Ensure all SQL scripts are run in correct order
   - Check PostgreSQL version compatibility
   - Verify RLS policies are set correctly

This system provides a robust foundation for dynamic, auto-changing promo codes that enhance your marketing capabilities while maintaining security and preventing abuse.