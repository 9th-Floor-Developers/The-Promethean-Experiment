## TITLE EFFECTS
Appear on top of the page and fade out for world events

Major events (bigger text)
Species going extinct
hitting milestone every time a species is at a 10^X population Ex: 10, 100, 1000, it should not show if the last milestone it hit is the same as this. to avoid spamming the same milestone for the same species

Minor event 
New day


## OVERHEAD EFFECTS
Make overhead effect for animals when things happen to each animal
including:
taking damage 
changing action

have the following be larger to see
spawning
dying
have it be shown as text over the position that pops up and fades out


## SOUND RINGS
When an animal makes a sound, an expanding ring in its species colour (the body colour of its look) shows how far the sound reaches
sounds with a ring: alarm calls (ALARM_CALLING) and sprinting (SPRINTING); walking noise has none, since nearly every animal walks all the time
the ring grows to the farthest distance any animal in the world can hear the sound (the largest hearing range among HEARING species x loudness: an alarm call 0.6, a sprint 0.4), then fades
no ring is drawn when no species in the world has HEARING, since then the sound affects nothing
an animal that keeps calling or sprinting sends out a new ring at most every 0.7 seconds
