# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

VibeDebt executes and refactors JavaScript/TypeScript source code. Because AST refactoring, dynamic boundary testing, and code execution occur locally, security and hermetic process boundaries are top priorities.

If you discover a security vulnerability (such as unintended execution, sandbox escape, or improper file system traversal outside the designated target directory):

1. **Do not** disclose the vulnerability publicly in issues or pull requests.
2. Send an email to security report contact or open a GitHub Private Security Advisory via the repository's **Security** tab.
3. Include detailed reproduction steps and affected target scenarios.
4. We will acknowledge receipt within 48 hours and work with you to test and release a patch.
