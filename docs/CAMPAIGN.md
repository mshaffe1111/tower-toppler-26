# Reboot campaign: 10 worlds

The Reboot campaign is 10 worlds of 5 towers (src/worlds.js), 50 towers in all, played from the
world map (REBOOT on the title).

## Shape of a world
- **Towers I-III:** introduce the world's twist, getting taller and harder.
- **Tower IV:** brings back the previous world's twist (a remix).
- **Tower V (▲ summit):** the tallest of the world, with its twist at full strength.
- **Worlds 8-10:** mix twists tower by tower. The very last tower (Edge of Doom V) is the storm
  with the guardian.

| World | Name | Twist | Look |
|---|---|---|---|
| 1 | Sunrise Shoals | none (learn the climb) | rock, timber, shingles; islands |
| 2 | Clockwork Keep | clockwork ledges | brass, steel, copper; city |
| 3 | Frostbite Spire | blizzard | ice, crystal; icebergs |
| 4 | Crumbling Mesa | crumbling base | sandstone, straw; mesas |
| 5 | Lantern Night | night storm | obsidian, steel, crystal; volcano |
| 6 | Rising Tide | rising sea | shingles, siding, copper; islands |
| 7 | Gale Plains | wind | straw, bamboo; dunes |
| 8 | Stormcrown | mixed | steel, obsidian, brass, ice; peaks |
| 9 | Abyss Rise | mixed | copper, sandstone, brass, obsidian; forest |
| 10 | Edge of Doom | mixed, guardian at the end | crystal, rock, obsidian, marble; volcano |

## Pacing
- **Height:** 40 rows (W1-I) to 100 rows (W10-V).
- **Difficulty:** 0.12 to 0.95 (the generator's knob). The game's own extras (spikers, patrols,
  flyer frequency, enemy speed) follow the same value.
- **Time limits:** 124-217 s. A first run of all 50 towers is about 2.5-3 hours plus retries.
- **Seeds are fixed:** a tower is the same every time, so medals and ghost races mean something.

## Progress
- `progress.rebootCleared` holds the highest tower index cleared. The next tower opens, and
  clearing a world's summit opens the next world.
- **Medals:** keys c101..c150.
- **Trophies:** one per world, Reboot Champion (all 50), tiered Combo Master and Explorer, and the
  Reboot Cabinet (250 medals).
- **Rides between towers:** the submarine stage runs between towers, as before.

## The Glide (between worlds)
- **What:** after a world's summit, Pogo hang-glides from it to the next world's island, instead
  of the sub (src/glideStage.js, src/glideRenderer.js).
- **Flying:** about 22 s. Slide left/right for speed, push up or tap to flap and climb, push down
  to dive. Thermals lift you.
- **Pickups:** lantern strings, star kites, a rare golden lantern, and ring gates (combo up to x4).
- **Hazards:** storm clouds that telegraph lightning, gull flocks, gust bands.
- **Sky:** each world has its own (dawn, day, snow, sunset, night, after-rain, gale, storm,
  ember).
- **Arrival:** you land beside the next world's tower, then get the score tally.

## Hidden puzzle rooms (built)
- **Where:** towers II and IV of every world (20 rooms) have a rune door, marked by a glowing
  carved rune. Inside is a torch-lit chamber (src/puzzleRoom.js logic, src/puzzleRenderer.js).
- **The clock:** the tower's clock stops while you're inside.
- **Four types, in rotation, all generated from the tower's seed and proven solvable:**
  - **Rune tiles:** stomp tiles to light a target pattern. The pattern is carved on the tower
    wall a few floors away, not shown inside.
  - **Bells:** ring them in order. The order is a row of coloured banners on the tower, a few
    floors away.
  - **Light beam:** rotate mirrors to guide the beam to the crystal.
  - **Stone blocks:** push the blocks onto the plates.
- **Reward:** a star-fish (counts toward the ⭐ Explorer medal), a key (keys open bonus towers,
  coming), +15 s and +1500. A solved door goes dim.
- **Trophy:** Rune Reader (1/10/20 rooms).

## Next
- Keys open bonus towers.
- More mini-games: a topple rhythm finale; bonus towers opened by keys.
