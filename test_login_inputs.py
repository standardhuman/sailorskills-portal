#!/usr/bin/env python3
"""
Test login page input visibility fix
Verifies that input fields are visible with correct styling
"""
from playwright.sync_api import sync_playwright
import sys

def test_login_inputs():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to login page
        page.goto('http://localhost:5174/login.html')
        page.wait_for_load_state('networkidle')

        # Take screenshot for visual verification
        page.screenshot(path='/tmp/login_page.png', full_page=True)
        print("✓ Screenshot saved to /tmp/login_page.png")

        # Check if email input is visible
        email_input = page.locator('#password-email')
        assert email_input.is_visible(), "Email input should be visible"
        print("✓ Email input is visible")

        # Check if password input is visible
        password_input = page.locator('#password')
        assert password_input.is_visible(), "Password input should be visible"
        print("✓ Password input is visible")

        # Test typing in email field
        email_input.fill('test@example.com')
        typed_value = email_input.input_value()
        assert typed_value == 'test@example.com', f"Email should be filled, got: {typed_value}"
        print("✓ Can type in email field")

        # Test typing in password field
        password_input.fill('testpassword')
        password_value = password_input.input_value()
        assert password_value == 'testpassword', f"Password should be filled, got: {password_value}"
        print("✓ Can type in password field")

        # Verify input styling by checking computed styles
        email_border = email_input.evaluate('el => window.getComputedStyle(el).borderColor')
        email_color = email_input.evaluate('el => window.getComputedStyle(el).color')

        print(f"✓ Email input border color: {email_border}")
        print(f"✓ Email input text color: {email_color}")

        # Ensure inputs are not white-on-white
        bg_color = email_input.evaluate('el => window.getComputedStyle(el).backgroundColor')
        print(f"✓ Email input background color: {bg_color}")

        # Border should not be transparent or white
        assert email_border not in ['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)', 'transparent'], \
            f"Border should be visible, got: {email_border}"
        print("✓ Input has visible border")

        # Text color should not be white or transparent
        assert email_color not in ['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)', 'transparent'], \
            f"Text should be visible, got: {email_color}"
        print("✓ Input has visible text color")

        browser.close()
        print("\n✅ All tests passed! Input fields are visible and functional.")
        return 0

if __name__ == '__main__':
    try:
        sys.exit(test_login_inputs())
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
