# OpenCode Remote Android — Claude Guidelines

## Prop hygiene

When removing a component or removing props from a component, always trace the full prop chain and remove them from every layer:

1. The component's own `Props` type
2. The component's destructuring parameters
3. Every parent that passes those props (e.g. `ChatScreen`, `App.tsx`)
4. Every parent's own `Props` / `ChatScreenProps` type

Run `npx tsc --noEmit` after any prop removal to confirm no TS6133 unused-variable errors remain before committing.
