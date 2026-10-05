# AI Ignore Guidance

Use this reference only to prepare a project-specific proposal when `.aiignore` is absent or incomplete. Never create or overwrite `.aiignore` without explicit approval, and verify the tool that will honor its syntax.

Common candidates for discussion include:

```text
# Secrets and machine-local settings
.env*
*.key
*.pem

# Generated or high-churn material
/output/
/dist/
/coverage/
/.cache/

# Dependency/vendor material when it is not the subject of the task
node_modules/
vendor/
```

Do not blindly copy these patterns. A project may intentionally track fixtures, generated release assets, or examples matching them. Explain each proposed pattern, identify its effect on the current task, and ask for confirmation.
