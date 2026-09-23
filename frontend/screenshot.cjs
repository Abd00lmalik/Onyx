const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const dir = 'C:\\Users\\USER\\AppData\\Local\\Temp\\opencode';

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // 1. Hero
  await page.screenshot({ path: `${dir}\\01-hero.png`, fullPage: false });

  // 2. Browse page
  await page.goto('http://localhost:5173/browse', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: `${dir}\\08-browse.png`, fullPage: false });

  // 3. Scroll browse to see cards
  await page.evaluate(() => window.scrollTo(0, 200));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${dir}\\09-browse-cards.png`, fullPage: false });

  // 4. First listing detail
  await page.goto('http://localhost:5173/listing/0x7a3f8c1e4b9d2f6a0e3c5b8d1f4a7c2e9b3d6f0a1c4e8b2d5f7a0c3e6b9d2f1a', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: `${dir}\\10-detail.png`, fullPage: false });

  // 5. CTA section
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  const headings = await page.$$('h2');
  for (const h of headings) {
    const text = await h.evaluate(el => el.textContent);
    if (text && text.includes('Ready to trade')) {
      await h.scrollIntoView();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${dir}\\11-cta.png`, fullPage: false });

  // 6. Full page
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${dir}\\12-fullpage.png`, fullPage: true });

  await browser.close();
  console.log('All screenshots saved.');
})()
