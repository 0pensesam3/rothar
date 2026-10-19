# What Rothar should do

This is the list the daily UX agent checks the app against. Each line is one behaviour, written so a test or a person can say yes or no to it. The test that checks it carries the same ID in its name, so `P3` in a test report means `P3` here.

Only Anya edits this file. The agents read it and never change it. If something here is wrong or out of date, the agents say so in their report and leave it for her to decide.

Lines marked *(judgement)* can't be fully settled by an automated check. The agents look at the screenshots for those and say what they think, but a pass there is an opinion, not proof.

## Starting up

- **B1** On opening, the app asks for your location and fills the start box with "Your location" once it has a fix. No tap needed.
- **B2** If location is refused, the app says so in plain words and still lets you type a start address.
- **B3** Docking stations near you show on the map, coloured by what they have: green for standard bikes, blue for e-bike only, amber for 1 or 2 bikes, red for empty.

## Search

- **S1** Suggestions start after 2 letters of a place name. Typing "Liv" offers Liverpool Street Station.
- **S2** Pressing Enter in a box picks the best match for what you typed, without tapping a suggestion.
- **S3** A UK postcode, full or partial (for example "E2 0"), offers matching postcodes.
- **S4** Places you've picked before show as "Recent" as soon as you tap into an empty box.
- **S5** Docking stations come up in search by name.
- **S6** If the address search service is down, typing still offers recent places and stations, and nothing breaks.

## Planning a trip

- **P1** With a start and a destination set, the app plans the trip straight away: walk to a dock, cycle, walk to the destination.
- **P2** The summary shows total time, an arrival clock time, and each leg's time. Total time includes about 90 seconds for undocking and docking.
- **P3** The pick-up dock always has a bike of the chosen type. The return dock always has at least one free space. A dock with 0 bikes is never the pick-up.
- **P4** Choosing E-bike or Standard re-plans so the pick-up dock has that type of bike.
- **P5** When the bike wouldn't save at least a minute over walking (dock time included), the app shows a walking plan instead, says "Faster to walk", and the button reads "Start walking".
- **P6** The step list reads like directions a person would follow. It doesn't repeat "You have arrived at your destination" partway through the trip.
- **P7** After planning, the whole trip (start, pick-up dock, return dock, destination) is in view on the map, not hidden under the search panel or the bottom sheet. *(partly judgement)*
- **P8** Changing the route type (Balanced, Fastest, Bike lanes) re-plans the trip.

## Navigating

- **N1** Start navigation switches to the navigation view: the turn card at the top, the trip bar at the bottom, the search panel hidden.
- **N2** The turn card shows the next manoeuvre and the distance to it, and the distance goes down as you move towards it.
- **N3** The arrow on the card points the same way as the words. "Turn right" shows a right-turn arrow, "Turn left" a left-turn arrow.
- **N4** Steps move on by themselves as you pass each turn. Reaching the pick-up dock shows "Pick up bike at …", reaching the return dock shows "Return bike at …".
- **N5** The bottom bar shows time left, arrival time and distance to go, and they go down as you travel.
- **N6** With a compass reading, the app says whether you're facing the right way: "Right way" when you face along the route, "Turn around" when you face the opposite way.
- **N7** Swiping the turn card left shows later turns ("Turn 2 of N ahead"). Tapping the card goes back to the live next turn.
- **N8** The End button needs two taps. One tap alone doesn't end the trip.
- **N9** Reaching the destination ends navigation with "You have arrived!" and the trip shows as completed in Activity, with the distance cycled.
- **N10** Closing or reloading the app mid-trip offers to resume that trip. Resuming puts you back in navigation.
- **N11** A walking-only trip navigates the same way, and its End button says "End walk".

## Messy GPS

Real phones jitter and drop out. These check the app copes with a bad fix as well as a clean one.

- **G1** A position more than 50 m uncertain doesn't move you along the route or skip a step.
- **G2** A single jump of 40 m that comes straight back doesn't change the step and doesn't count as going off route.
- **G3** If GPS goes quiet for 20 seconds mid-trip, the app says it's lost your position. When it comes back, it carries on from the right step without restarting the trip.
- **G4** A wrong compass reading only changes the "Right way / Turn around" hint, never the directions.

## Off route

- **O1** More than 40 m from the route for 15 seconds, the app says you're off route.
- **O2** It then re-plans from where you are to the same dock or destination, and navigation carries on without a tap.

## Dock availability

- **A1** During navigation, the live count at the dock you're heading to shows under the turn card.
- **A2** The pick-up dock is re-checked from about 5 minutes before you reach it. If it drops below 2 usable bikes, a popup says how many are left and offers Wait or Reroute.
- **A3** The return dock is re-checked from about 5 minutes before you reach it, by time left on the road, not only once you're at the dock. If it drops below 2 free spaces, the same popup appears for docks.
- **A4** Reroute picks a different dock that has what you need, and navigation carries on to it.
- **A5** After Wait, if the dock recovers, the popup goes away and the app says the bikes or spaces are back.

## When things go wrong

- **R1** If TfL station data can't load, the app says so and doesn't crash.
- **R2** If routing is down, the app still plans with estimated distances and says they're estimated.
- **R3** No uncaught JavaScript errors in any of the above.
- **R4** If the main router takes more than 8 seconds or fails, the backup router plans the trip with real directions, not estimates.
- **R5** If TfL station data takes more than 8 seconds, the app says it's still loading, then shows the R1 message if it fails. Never a blank map with no explanation.
- **R6** While a plan is loading, the screen shows it's working, and Start can't be tapped on a half-built plan.

## Awkward trips

- **T1** If the destination is a docking station with a free space, you return the bike there and there's no walk at the end.
- **T2** If there's no dock within 800 m of the start or destination, the app uses the nearest one further away and says how far the walk is.
- **T3** With E-bike chosen and no e-bikes nearby, the app says so and offers Standard. It never quietly picks a standard bike.
- **T4** Start and destination in the same place: the app says so and doesn't plan or error.

## Impatient user

- **U1** Tapping Start navigation twice quickly starts one trip: one Activity entry, one set of directions.
- **U2** Planning a new trip while the last one is still loading only ever shows the newest plan.
- **U3** If location is refused when you tap Start navigation, the app says navigation needs your location and stays on the plan.
- **U4** Changing the destination mid-trip re-plans from where you are and carries on navigating. If you've already picked up a bike, the new plan keeps you on it.

## Privacy

- **V1** Usage counts sent to GoatCounter contain only action names. Never coordinates, addresses, station names or what you searched for.
- **V2** "Powered by TfL Open Data" is visible on the map screen.

## Look and feel *(judgement)*

- **L1** On a 390 px wide phone screen nothing important is cut off, overlapping or unreadable: buttons, the turn card, the bottom bar, the popup.
- **L2** Text on the turn card is readable at a glance: large manoeuvre, short road line, distance easy to find.
- **L3** Colours stay consistent: red for cycling, purple for walking to and from docks, green for walking-only.
- **L4** On a 375 × 667 screen (iPhone SE), nothing important is cut off or overlapping.
- **L5** In landscape, the map, turn card and bottom bar all still fit on screen.
- **L6** A very long road or station name wraps or shortens with "…" and never pushes a button off screen.

## Free roam

- **X1** Once a week an agent uses the app however it likes and reports anything that looks wrong. Its findings are never sent to the fixer. Anya decides which ones become lines here.
