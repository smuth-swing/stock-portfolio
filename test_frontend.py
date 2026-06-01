import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Capture console messages
        page.on("console", lambda msg: print(f"Console {msg.type}: {msg.text}"))
        # Capture page errors (uncaught exceptions)
        page.on("pageerror", lambda err: print(f"PageError: {err.message}"))
        
        print("Navigating to URL...")
        response = await page.goto("https://smuth-swing.github.io/stock-portfolio/mobile/")
        print(f"Status code: {response.status}")
        
        # Wait a few seconds for JS to execute
        await page.wait_for_timeout(5000)
        
        # Print the body HTML
        body_html = await page.evaluate("document.body.innerHTML")
        print("\n--- BODY HTML ---")
        print(body_html[:1000]) # Print first 1000 chars
        print("--- END BODY ---")
        
        await browser.close()

asyncio.run(main())
