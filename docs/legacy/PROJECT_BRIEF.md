# Project Brief: The Family Hub

## 1. Project Mission & Vision

To create a central, always-on digital hub that simplifies family organization, fosters a greater sense of connection, and brings structure and predictability to the home. Our vision is to reduce the mental load of running a household and create a single source of truth for "what's happening."

## 2. Problem Statement

In many multi-generational households, coordinating schedules and managing responsibilities is a constant source of friction and stress. This is amplified in families managing neurodiversity like ADHD, where a lack of visible structure and predictability can be disruptive. Existing digital tools are often siloed on personal devices, failing to provide a persistent, at-a-glance overview for the entire family unit. We aim to solve this by providing a simple, central, and always-visible command center for the family.

## 3. Target Audience

Multi-generational households, with a primary focus on families coping with ADHD. These users value simplicity, clear visual information, and systems that promote routine and predictability. They are likely existing users of Google's ecosystem.

## 4. Proposed Solution

We will design and build a physical, wall-mounted smart display with a clean, intuitive touchscreen interface. This device will act as the family's organizational hub. The initial version will focus on two core functionalities seamlessly integrated with Google services.

## 5. Core Features (Version 1.0)

### Family Calendar

- Displays a consolidated, color-coded view of events from family members' Google Calendars
- Features real-time, two-way synchronization with the Google Calendar API
- The interface will be optimized for simplicity and readability from a distance

### Family Chores

- Displays tasks and chores assigned to different family members
- Features real-time, two-way synchronization with the Google Tasks API
- Users can easily view their assignments and mark chores as complete directly on the device

## 6. Unique Value Proposition

- **Radical Simplicity:** An uncluttered, "it just works" user experience that stands in contrast to feature-bloated apps
- **Seamless Google Integration:** By leveraging Google Calendar and Tasks, we meet users where they are, making setup and adoption frictionless
- **Always-On Visibility:** The dedicated hardware ensures the family's schedule and responsibilities are always visible, reinforcing structure and reducing the need to actively check a phone or computer

## 7. Future Opportunities (Post-V1)

- Investigate and scope a "Points & Rewards" system for chore completion to gamify household contributions
- Explore additional modules like Meal Planning, Shared Lists, and Photo Displays as seen in the mockups

## 8. Success Metrics

### Primary Metrics

- **Adoption Rate:** % of family members actively using the hub daily
- **Task Completion Rate:** % increase in chore completion
- **User Satisfaction:** NPS score from family members
- **System Reliability:** 99.9% uptime for sync services

### Secondary Metrics

- **Setup Time:** < 10 minutes from unboxing to operational
- **Daily Active Usage:** Average interactions per day
- **Sync Performance:** < 5 second sync cycles
- **Error Rate:** < 0.1% failed syncs

## 9. Technical Requirements

### Hardware Requirements

- Touch-capable display (10"+ recommended)
- Wall-mountable form factor
- WiFi connectivity
- Low power consumption for 24/7 operation

### Software Requirements

- Progressive Web App (PWA) for offline capability
- Google OAuth 2.0 integration
- Real-time synchronization
- Responsive design for various display sizes

## 10. Design Requirements

### Visual Design

- High contrast, ADHD-friendly color schemes
- Large, readable typography (minimum 16px base)
- Clear visual hierarchy
- Consistent iconography

### Interaction Design

- Touch targets minimum 48x48px
- Single-tap interactions preferred
- Visual feedback for all actions
- No hidden gestures or complex interactions

## 11. Constraints & Considerations

### Technical Constraints

- Must work within Google API rate limits
- Limited to Google ecosystem (no Microsoft/Apple calendar support in V1)
- Requires persistent internet connection

### User Constraints

- All family members must have Google accounts
- Requires dedicated display hardware
- Limited customization to maintain simplicity

## 12. Project Timeline

### Phase 1: Foundation (Weeks 1-2)

- Project setup and architecture
- Google OAuth implementation
- Basic UI framework

### Phase 2: Calendar Module (Weeks 3-4)

- Calendar API integration
- Calendar UI components
- Multi-member calendar merging

### Phase 3: Chores Module (Weeks 5-6)

- Tasks API integration
- Chores UI components
- Completion tracking

### Phase 4: Polish & Deploy (Weeks 7-8)

- UI/UX refinement
- Performance optimization
- Deployment setup
- User testing
