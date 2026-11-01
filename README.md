# Robot Practice Sim

A tiny block-coding robot simulator for kids to practice while they wait their turn with the real robot. Pure static site (no build step). Blocks are powered by [Blockly](https://developers.google.com/blockly), loaded from a CDN.

## Publish on GitHub Pages

1. Create a new GitHub repo and add `index.html`, `style.css`, `app.js`, `README.md` at the top level.
2. Repo **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`.
3. Visit `https://<your-username>.github.io/<repo-name>/` after a minute or two.

## Try it locally

    python3 -m http.server 8000

then open http://localhost:8000.

## Adding challenges

Edit the `LEVELS` array at the top of `app.js`. Each level has a start pose, `obstacles`, colored `lines`, `targets`, and a `check` function. Distances are in cm on a 236 x 114 cm mat.

## How the robot is wired

The simulated robot has its left wheel motor on port A, right wheel motor on port E, arm motor on port C (clockwise lowers it) and the color sensor on port F. Programs must start with "set movement motors" using the right ports, like on the real brick. Kids can tick **Hard mode** to hide the wiring panel. Edit `WIRING` in `app.js` to change the layout.

## Bases, dragging and buttons

The two quarter-circle bases sit in the bottom corners. Drag the robot to move it (it snaps into the nearest base, so you can carry it from one to the other) and drag the orange dot to aim it in 5° steps. Press **Run** to start the program ("when program starts"); after that, the left and right hub buttons, either the little ones drawn on the robot or the buttons under the mat, run the "when left/right button is pressed" stacks. Motor setup done in the start stack carries over to those stacks, like on the real hub.

## Notes

- The mat is a generic practice field, not the official season mat. Tune `BASE_SPEED`, `BASE_TURN`, and the robot size in `app.js` to match your team's robot.
- Kids' programs auto-save in the browser (localStorage).
