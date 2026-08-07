# CredGuard

CredGuard is a Visual Studio Code extension for detecting hardcoded credentials in source code using Pattern Matching (Regex) and Shannon Entropy.

## Features

CredGuard provides real-time detection for common hardcoded credentials, including:

- AWS Access Key ID
- Google Cloud API Key
- Stripe Secret Key
- GitHub Personal Access Token
- JSON Web Token (JWT)
- Private Key (PEM)
- Hardcoded Password
- Slack Bot Token
- High-Entropy Secret (Shannon Entropy)

## Supported File Types

- JavaScript (.js)
- TypeScript (.ts)
- Python (.py)
- PHP (.php)
- Environment Variables (.env)

## How It Works

CredGuard automatically scans supported source code files while editing.

When a credential is detected, the extension:

- Highlights the detected credential.
- Displays a diagnostic warning.
- Provides a link to the official security documentation.

## Installation

Install the `.vsix` package using:

Extensions → Install from VSIX...

## Technologies

- TypeScript
- Visual Studio Code Extension API
- Regular Expression (Regex)
- Shannon Entropy

## Version

Current Version: **1.0.0**

---

Developed as an undergraduate research project.