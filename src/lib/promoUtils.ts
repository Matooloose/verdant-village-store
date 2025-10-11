// Auto-generating promo code utilities
// Add this to src/lib/promoUtils.ts

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { supabaseAny } from '@/integrations/supabase/client';

export interface AutoPromoConfig {
  type: 'daily' | 'weekly' | 'flash' | 'seasonal' | 'random';
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue?: number;
  maxDiscountCap?: number;
  durationHours?: number;
  usageLimit?: number;
}

// Generate time-based promo codes
export const generateTimeBasedCode = (type: 'daily' | 'weekly' | 'monthly'): string => {
  const now = new Date();
  
  switch (type) {
    case 'daily':
      return `DAILY${now.getMonth() + 1}${now.getDate()}${now.getFullYear()}`;
    case 'weekly': {
      const weekNum = getWeekNumber(now);
      return `WEEK${weekNum}${now.getFullYear()}`;
    }
    case 'monthly':
      return `MONTH${now.getMonth() + 1}${now.getFullYear()}`;
    default:
      return 'SPECIAL';
  }
};

// Generate random promo codes
export const generateRandomCode = (length: number = 8, prefix: string = 'AUTO'): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = prefix;
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

// Generate flash sale codes
export const generateFlashCode = (durationHours: number = 2): string => {
  const now = new Date();
  const timestamp = now.getTime().toString().slice(-6);
  return `FLASH${timestamp}`;
};

// Generate seasonal codes
export const generateSeasonalCode = (): { code: string; season: string; discount: number } => {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  
  let season: string;
  let discount: number;
  
  if (month >= 12 || month <= 2) {
    season = 'SUMMER';
    discount = 25;
  } else if (month >= 3 && month <= 5) {
    season = 'AUTUMN';
    discount = 20;
  } else if (month >= 6 && month <= 8) {
    season = 'WINTER';
    discount = 30;
  } else {
    season = 'SPRING';
    discount = 22;
  }
  
  return {
    code: `${season}${year}`,
    season: season.toLowerCase(),
    discount
  };
};

// Get week number
const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// Auto-create promo codes in database
export const createAutoPromo = async (config: AutoPromoConfig, supabase: SupabaseClient<Database>): Promise<string> => {
  let code: string;
  let description: string;
  const startDate = new Date();
  const endDate = new Date();
  
  switch (config.type) {
    case 'daily':
      code = generateTimeBasedCode('daily');
      description = `Daily special - ${config.discountValue}${config.discountType === 'percentage' ? '%' : 'R'} off`;
      endDate.setDate(endDate.getDate() + 1);
      break;
      
    case 'weekly':
      code = generateTimeBasedCode('weekly');
      description = `Weekly deal - ${config.discountValue}${config.discountType === 'percentage' ? '%' : 'R'} off`;
      endDate.setDate(endDate.getDate() + 7);
      break;
      
    case 'flash':
      code = generateFlashCode(config.durationHours || 2);
      description = `FLASH SALE! ${config.discountValue}${config.discountType === 'percentage' ? '%' : 'R'} off - Limited time!`;
      endDate.setHours(endDate.getHours() + (config.durationHours || 2));
      break;
      
    case 'seasonal': {
      const seasonal = generateSeasonalCode();
      code = seasonal.code;
      description = `${seasonal.season} special - ${seasonal.discount}% off fresh produce`;
      endDate.setMonth(endDate.getMonth() + 3);
      config.discountValue = seasonal.discount;
      break;
    }
      
    case 'random':
      code = generateRandomCode();
      description = `Special offer - ${config.discountValue}${config.discountType === 'percentage' ? '%' : 'R'} off`;
      endDate.setDate(endDate.getDate() + 30);
      break;
      
    default:
      throw new Error('Invalid promo type');
  }
  
  // Insert into database
  const { data, error } = await supabaseAny
    .from('promo_codes')
    .insert({
      code,
      description,
      discount_type: config.discountType,
      discount_value: config.discountValue,
      min_order_value: config.minOrderValue || 0,
      max_discount_cap: config.maxDiscountCap,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      usage_limit: config.usageLimit || null,
      used_count: 0,
      is_active: true
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating auto promo:', error);
    throw error;
  }
  
  return code;
};

// Pre-configured auto promo templates
export const AUTO_PROMO_TEMPLATES = {
  dailySpecial: {
    type: 'daily' as const,
    discountType: 'percentage' as const,
    discountValue: 15,
    minOrderValue: 150,
    usageLimit: 100
  },
  
  weeklyDeal: {
    type: 'weekly' as const,
    discountType: 'percentage' as const,
    discountValue: 20,
    minOrderValue: 200,
    maxDiscountCap: 100,
    usageLimit: 200
  },
  
  flashSale: {
    type: 'flash' as const,
    discountType: 'percentage' as const,
    discountValue: 30,
    minOrderValue: 100,
    maxDiscountCap: 200,
    durationHours: 2,
    usageLimit: 50
  },
  
  seasonalSpecial: {
    type: 'seasonal' as const,
    discountType: 'percentage' as const,
    discountValue: 25, // Will be overridden by seasonal logic
    minOrderValue: 300,
    maxDiscountCap: 150,
    usageLimit: 1000
  }
};

// Usage examples:
/*
import { createAutoPromo, AUTO_PROMO_TEMPLATES } from '@/lib/promoUtils';
import { supabase } from '@/integrations/supabase/client';

// Create daily promo
const dailyCode = await createAutoPromo(AUTO_PROMO_TEMPLATES.dailySpecial, supabase);

// Create flash sale
const flashCode = await createAutoPromo({
  ...AUTO_PROMO_TEMPLATES.flashSale,
  durationHours: 4,
  discountValue: 35
}, supabase);

// Create custom random promo
const randomCode = await createAutoPromo({
  type: 'random',
  discountType: 'fixed',
  discountValue: 75,
  minOrderValue: 250,
  usageLimit: 150
}, supabase);
*/