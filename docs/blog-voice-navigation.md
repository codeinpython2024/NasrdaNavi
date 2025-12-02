# Building a Voice-Guided Campus Navigation System with African Language Support

*How we created an accessible, culturally-aware navigation assistant for NASRDA's campus*

---

## Introduction

Navigation apps are everywhere, but most are designed with Western users in mind. When we set out to build **NasrdaNavi** — a campus navigation system for Nigeria's National Space Research and Development Agency (NASRDA) — we wanted something different. We wanted a voice assistant that sounds familiar, speaks naturally, and guides users through the campus like a friendly local would.

This post dives deep into how we built the voice navigation system, from the technical architecture to the cultural considerations that shaped our design decisions.

## The Challenge

Campus navigation presents unique challenges:

1. **Indoor/outdoor transitions** — Users move between buildings, walkways, and open spaces
2. **Accessibility** — Not everyone can look at their phone while walking
3. **Cultural relevance** — Generic robotic voices feel impersonal and foreign
4. **Real-time guidance** — Turn-by-turn directions need to be timely and clear

We decided early on that voice would be a first-class citizen in NasrdaNavi, not an afterthought.

## Architecture Overview

The voice navigation system spans both frontend and backend:

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ VoiceAssist │──│ MascotAnim   │──│ NavigationManager │  │
│  │   (TTS)     │  │   (GSAP)     │  │    (Routing)      │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ GraphBuilder│──│RoutingService│──│ NavigationService │  │
│  │  (NetworkX) │  │  (Dijkstra)  │  │ (Turn-by-Turn)    │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## The Voice Assistant: More Than Just Text-to-Speech

### African Language Prioritization

The Web Speech API provides access to system voices, but the available voices vary wildly across devices and browsers. Our solution? A cascading preference system that prioritizes African voices:

```javascript
class VoiceAssistant {
    constructor() {
        // African language codes in order of preference
        this.africanLangCodes = [
            'en-NG',  // Nigerian English
            'en-GH',  // Ghanaian English  
            'en-KE',  // Kenyan English
            'en-ZA',  // South African English
            'yo-NG',  // Yoruba (Nigeria)
            'ha-NG',  // Hausa (Nigeria)
            'ig-NG',  // Igbo (Nigeria)
            'sw',     // Swahili
            'zu-ZA',  // Zulu (South Africa)
        ];
        
        // Pattern matching for voice names
        this.africanVoicePatterns = [
            /nigeri/i, /lagos/i, /abuja/i,
            /ghana/i, /kenya/i, /africa/i,
            /yoruba/i, /hausa/i, /igbo/i,
            /tunde/i, /ade/i, /chidi/i, // Common Nigerian names
        ];
    }
}
```

The voice selection algorithm tries three strategies:

1. **Exact language code match** — Look for voices with African locale codes
2. **Name pattern matching** — Some systems use descriptive names instead of proper codes
3. **Graceful fallback** — Default to the system voice if no African voice is found

### Personality Through Phrases

A navigation assistant shouldn't sound like a robot reading a manual. We inject personality through randomized phrase variations:

```javascript
announceStart() {
    const phrases = [
        "Start point set! Now tap where you want to go.",
        "Starting point locked. Click your destination now.",
        "Nice one! Now select your destination.",
    ];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    this.speak(phrase, true);
}

announceArrival() {
    const phrases = [
        "You have arrived at your destination. Well done!",
        "You don reach! This is your destination.",  // Nigerian Pidgin
        "Destination reached! Safe travels.",
    ];
    // ...
}
```

Notice the Nigerian Pidgin phrase "You don reach!" — these cultural touches make the assistant feel local and relatable.

### Speech Queue Management

Voice navigation needs to handle interruptions gracefully. If a user triggers a new action while the assistant is speaking, we need to decide: queue the new message, or interrupt?

```javascript
speak(text, priority = false) {
    if (!this.enabled || !text) return;

    // Cancel ongoing speech for priority messages
    if (priority) {
        this.synth.cancel();
        this.queue = [];
        this.isSpeaking = false;
    }

    this.queue.push(text);
    this.processQueue();
}
```

Priority messages (like route announcements) interrupt everything. Regular messages queue up and play in order.

## The Mascot: Visual Feedback for Voice

Voice-only feedback isn't enough. Users need visual confirmation that the assistant heard them and is responding. Enter "Navi" — our animated mascot.

### Speaking Animation

When the voice assistant speaks, the mascot avatar pulses:

```css
.voice-mascot-avatar.speaking {
    animation: mascot-speak 0.5s ease-in-out infinite;
    box-shadow: 0 0 30px rgba(255, 140, 0, 0.6);
}

@keyframes mascot-speak {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
}
```

A pulsing ring effect reinforces the "speaking" state:

```css
.voice-mascot-avatar.speaking + .voice-mascot-ring {
    animation: pulse-ring 1s ease-out infinite;
}

@keyframes pulse-ring {
    0% { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(1.5); opacity: 0; }
}
```

### The Splash-to-Corner Transition

One of our favorite animations: when the app loads, the mascot starts large and centered on the splash screen, then "flies" to its corner position when the user clicks "Start Exploring":

```javascript
transitionFromSplash() {
    return new Promise(resolve => {
        const splashRect = this.splashMascot.getBoundingClientRect();
        const targetRect = this.voiceMascot.getBoundingClientRect();

        // Create flying mascot clone
        const flyingMascot = document.createElement('img');
        flyingMascot.src = '/static/Vector.png';
        // Position at splash location
        flyingMascot.style.left = `${splashRect.left}px`;
        flyingMascot.style.top = `${splashRect.top}px`;
        
        // Animate to corner
        gsap.to(flyingMascot, {
            left: targetRect.left,
            top: targetRect.top,
            width: 64,
            height: 64,
            rotation: 360,
            duration: 1.2,
            ease: 'power2.inOut',
            onComplete: () => {
                gsap.set(this.voiceMascot, { opacity: 1 });
                flyingMascot.remove();
                this.playEntranceAnimation();
                resolve();
            }
        });
    });
}
```

This creates a delightful moment of continuity — the mascot doesn't just appear, it *arrives*.

## Backend: Generating Turn-by-Turn Directions

Voice navigation is only as good as the directions it speaks. Our backend generates human-readable instructions from raw route geometry.

### Building the Road Graph

We use NetworkX to build a graph from GeoJSON road data:

```python
class GraphBuilder:
    def build_from_roads(self, roads_gdf):
        for _, row in roads_gdf.iterrows():
            road_name = row.get("name", "Unnamed Road")
            for line in self._line_geometries(row.geometry):
                coords = list(line.coords)
                for i in range(len(coords) - 1):
                    p1, p2 = coords[i], coords[i + 1]
                    length_m = haversine_distance(p1[0], p1[1], p2[0], p2[1])
                    self.graph.add_edge(p1, p2, weight=length_m, road_name=road_name)
```

Each edge stores:
- **weight** — Distance in meters (for shortest-path calculation)
- **road_name** — For generating spoken directions

### Calculating Bearings and Turns

To generate "turn left onto Main Street" instructions, we need to detect turns. This requires calculating the bearing (compass direction) between consecutive road segments:

```python
def calculate_bearing(p1, p2):
    """Calculate bearing between two points (lon, lat)."""
    lon1, lat1 = p1
    lon2, lat2 = p2
    return math.degrees(math.atan2(lat2 - lat1, lon2 - lon1))

def turn_direction(angle_diff):
    """Determine turn direction from angle difference."""
    if abs(angle_diff) < 20:
        return "Continue straight"
    elif angle_diff > 20:
        return "Turn left"
    else:
        return "Turn right"
```

### Generating Instructions

The NavigationService walks the path and generates instructions at each turn:

```python
def generate_turn_instructions(self, path):
    instructions = []
    total_distance = 0.0
    segment_distance = 0.0

    for i in range(len(path) - 1):
        edge_data = self.graph.get_edge_data(path[i], path[i + 1])
        road_name = edge_data["road_name"]
        dist = edge_data["weight"]
        segment_distance += dist
        total_distance += dist

        if i < len(path) - 2:
            prev_bearing = calculate_bearing(path[i], path[i + 1])
            next_bearing = calculate_bearing(path[i + 1], path[i + 2])
            diff = (next_bearing - prev_bearing + 180) % 360 - 180

            turn = turn_direction(diff)
            next_road = self.graph.get_edge_data(path[i + 1], path[i + 2])["road_name"]

            if turn != "Continue straight":
                instructions.append({
                    "text": f"Continue on {road_name} for {int(segment_distance)} meters, then {turn.lower()} onto {next_road}.",
                    "location": path[i + 1]
                })
                segment_distance = 0.0

    instructions.append({
        "text": f"Continue on {road_name} for {int(segment_distance)} meters and arrive at your destination.",
        "location": path[-1]
    })

    return instructions, total_distance
```

The output is a list of instruction objects, each with:
- **text** — The spoken instruction
- **location** — Coordinates for displaying markers on the map

## Putting It All Together

When a user clicks two points on the map:

1. **Frontend** sends coordinates to `/api/v1/route`
2. **Backend** snaps points to the road graph, runs Dijkstra's algorithm, generates turn-by-turn instructions
3. **Frontend** receives the route and instructions
4. **VoiceAssistant** announces the route summary and first instruction
5. **MascotAnimator** shows the mascot speaking
6. **Map** displays the route with a glowing line effect

The result? A navigation experience that feels personal, accessible, and distinctly African.

## Lessons Learned

### 1. Voice Selection is Fragile

The Web Speech API's voice availability is inconsistent. Always have fallbacks, and test on multiple devices.

### 2. Personality Matters

Small touches like randomized phrases and cultural references transform a utility into an experience.

### 3. Visual + Audio = Better UX

Voice feedback alone isn't enough. Pair it with visual indicators so users know the system is responding.

### 4. Test with Real Users

Our Nigerian Pidgin phrases came from user feedback. What sounds natural to developers might not resonate with actual users.

## What's Next

We're exploring:
- **Voice input** — "Hey Navi, take me to the cafeteria"
- **Offline support** — Caching routes and using local TTS
- **More languages** — Yoruba, Hausa, and Igbo full translations
- **Real-time position tracking** — GPS-based "you are here" updates

## Conclusion

Building NasrdaNavi taught us that navigation is about more than algorithms and coordinates. It's about creating an experience that feels helpful, familiar, and human. By prioritizing African voices, adding personality through phrases, and pairing voice with visual feedback, we've created something that serves our users in a way that generic navigation apps never could.

The code is open for exploration. If you're building navigation for underserved regions, we hope this inspires you to think beyond the defaults.

---

*NasrdaNavi is a campus navigation system developed for NASRDA. Built with Flask, NetworkX, Mapbox GL JS, and the Web Speech API.*
