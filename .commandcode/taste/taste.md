# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# architecture
- Keep business logic in custom hooks, not in screen components. Screens should only handle UI rendering, navigation, and device APIs (camera, audio, etc.). Confidence: 0.75
- When a hook or file becomes dead code after a refactor (no imports found), delete it rather than patching it to compile. Confidence: 0.70

# typescript
- This is a TypeScript React Native project. Always use TypeScript (.ts/.tsx) for all new files. Confidence: 0.80
