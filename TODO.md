# TODO

## Completed

- Added confirmation before deleting a session.
  - Shows a modal with session title/directory and Cancel/Delete actions.
- Improved session navigation/control flow.
  - Session cards open on tap/click and keyboard Enter/Space.
  - Detail screen has a visible “← Sessions” back button.
  - New sessions open directly in detail view.
  - New Session button is disabled while creation is in progress to avoid duplicate sessions.
  - Session list has a manual Refresh button.
  - Empty sessions no longer waste vertical space with an empty Todo box.
  - Empty/loading chat state is compact so the composer is visible on phone screens.

## UX/UI review

- Rework navigation between session detail and session list.
- Review placement and visibility of primary controls on mobile.
- Improve overall session list/detail usability.
- Review empty/loading/error states.
- Make destructive actions visually distinct and harder to trigger accidentally.

## Platform maintenance

- Upgrade Capacitor from 6.1.2 to Capacitor 8.
  - Check Node.js 22+ requirement.
  - Update Android SDK/target SDK 36 and Gradle/AGP as required.
  - Verify Android edge-to-edge/system bars behavior after upgrade.
  - Rebuild APK and retest local HTTP OpenCode connection.

## Notes from device testing

- Android APK now connects correctly to an unauthenticated local OpenCode server even with username/password empty.
- Session listing and session creation work after removing the password-required refresh guard.
