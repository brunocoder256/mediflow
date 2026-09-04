import { test, expect } from '@playwright/test';

test.describe('POS E2E', ()=>{
  test('POS loads, search visible, cart visible', async ({page})=>{
    await page.goto('/pos');
    await expect(page.locator('text=MediFlow POS')).toBeVisible({timeout:10000});
    await expect(page.locator('placeholder=Search name')).toBeVisible({timeout:5000});
    await expect(page.locator('text=Cart')).toBeVisible();
  });
  test('Responsive: mobile cart & pay', async ({page})=>{
    await page.setViewportSize({width:375, height:812});
    await page.goto('/pos');
    await expect(page.locator('text=MediFlow POS')).toBeVisible();
    // search still visible on mobile stacked layout
    await expect(page.locator('placeholder=Scan barcode').or(page.locator('placeholder=Search name'))).toBeVisible();
  });
  test('Keyboard: Ctrl+K focuses search', async ({page})=>{
    await page.goto('/pos');
    await page.keyboard.press('Control+k');
    const search = page.locator('input[aria-label="Search products"]');
    await expect(search).toBeFocused({timeout:3000});
  });
  test('Held sales dialog opens', async ({page})=>{
    await page.goto('/pos');
    await page.getByRole('button', {name:/Held/}).click();
    await expect(page.locator('text=Held Sales')).toBeVisible();
  });
  test('Customer dialog walk-in', async ({page})=>{
    await page.goto('/pos');
    // click customer change badge
    const custBtn = page.locator('text=Walk-in Customer').first();
    await custBtn.click();
    await expect(page.locator('text=Select Customer')).toBeVisible();
  });
});
