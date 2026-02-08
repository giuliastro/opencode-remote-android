# OpenCode Remote v1.1.0

This release delivers a full visual redesign focused on clarity, mobile usability, and faster in-app navigation.

## Highlights

- Complete UI redesign with refreshed layout, typography, spacing, and visual hierarchy.
- New icon system across the app for a cleaner and more consistent interface.
- Improved mobile navigation with a dedicated menu view and denser menu cards.
- Header simplified for mobile readability, now using the official app icon.
- Sessions list fixed on mobile so cards grow with content and action buttons remain visible.
- Todo Items section in session detail is now collapsible and collapsed by default.
- Help and documentation views updated with improved structure and readability.
- Android icon pipeline aligned to consistently generate launcher icons from the latest branding source.

## Quality and Stability

- Fixed TypeScript build issues caused by icon prop usage during the redesign rollout.
- Preserved existing server connectivity, session management, and command workflows.

## Upgrade Notes

- If you install over an older Android build and still see the old launcher icon, remove and reinstall the app once to clear launcher icon cache.
- CI release artifacts now use the updated icon source configuration.
