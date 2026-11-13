# Work in progress, saved but not applied

`camera-ui.patch` is the unfinished vintage-camera look for the capture screen (src/capture/ui): a
visual pass only, paused before its final checks. It is kept here as a patch so it survives without
changing the app. Its rendered art is already in `assets/capture/` (unused until the patch is applied)
and its Blender sources are `scripts/blender/props/camera_*.py`.

To pick it up again: `git apply docs/wip/camera-ui.patch`, finish and verify on a real phone, then
delete this folder.
