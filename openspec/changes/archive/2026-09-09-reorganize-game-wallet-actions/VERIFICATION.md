# Wallet action reorganization verification

- Focused wallet and live-boarding tests: 11 passed. New evidence test failed before implementation, then passed.
- npm run build: passed with existing large-chunk warning; sandbox spawn EPERM required the supported build escalation.
- Chrome real-browser isolated fixture at localhost:5174/tests/f2-payment.html: F1 Logout only; F2 Boarded removes submission; waiting disables with Awaiting Confirmation; unknown disables with Status Unavailable; Details remains enabled in those settled UI states.
- Low-balance fixture plus explicit player login: F3 disabled with (Awaiting Balance), Balance: 0 sats.
- Funded fixture plus explicit login: F3 enabled. Clicking submitted exactly once, disabled during Sending, and returned enabled after completion with Unknown User Sent You 1000 Sats toast.
- Missing-player guard remains disabled and explained separately; no false Awaiting Balance label.
- Fixtures simulate evidence only. No real Signet payment was sent for this reorganization. The existing live demo tab was controlled by another task, so its current wallet state was not inspected.
- Completed boarding detection depends on retained wallet-scoped operation locators and fresh matching network transactions. Boarding performed elsewhere without retained locators cannot be inferred from balance alone.
