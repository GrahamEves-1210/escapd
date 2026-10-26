# Next task for Claude Code

Two fixes:

1. **Bug:** the Noir "light pool" radial gradients render as solid #F2F2F2 rectangles on device (hub top, hub lower half, guide illustration panel). React Native can't do CSS radial gradients. Rebuild them with react-native-svg RadialGradient, or remove them. Verify there are no opaque light rectangles anywhere.

2. **Direction change:** the play screen (/play) and light table are the visual identity — brass accent, Playfair case titles, film-plate framing, mono plate labels. Restyle the hub (/), the photo guide and the Pro screen to match THAT look (keep the silk background and pill buttons from Noir), and update docs/DESIGN.md and tokens to match. Don't change /play or the light table except to fix inconsistencies.

First commit the current work on a branch called `redesign-noir` (not main) so it can be undone. Show me a summary before committing the new changes.
