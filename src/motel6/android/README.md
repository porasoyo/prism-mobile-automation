# Motel 6 Android Automation (Login Module)

## 📁 Structure (POM)

```
src/motel6/android/
├── pages/
│   ├── LoginPage.ts
│   ├── ForgotPasswordPage.ts
│   └── RegisterPage.ts
└── tests/
    └── regression/
        └── android.regression.spec.ts   # single Android regression spec
```

## ✅ What This Covers (Right Now)

Login module element extraction (no test data needed yet):
- Sign-in screen: email + password + sign-in button
- Forgot password screen: email + send reset link
- Register screen: first/last/mobile/email/password + create account + terms/promotions

## 🚀 Run (Real Device)

```bash
./run-test.sh src/motel6/android/tests/regression/android.regression.spec.ts
```

## 📦 Output (Extracted Elements + Stable Locators)

Each run writes XML + JSON dumps under `element_extraction/`.

Use the latest 3 locator-map JSONs:
- `*__android_login__login_locators.json`
- `*__android_forgot_password__forgot_locators.json`
- `*__android_register__register_locators.json`

These maps are based on stable `resource-id` locators (preferred), not fragile text.
