# Sailor Skills Portal - Product Roadmap

This document outlines planned features and improvements for the Sailor Skills Customer Portal.

---

## ✅ Completed Features (Phase 1)

### Core Portal Experience
- **Dashboard** - Paint condition slider, latest service summary, vessel condition cards
- **Service History** - Complete timeline of services with expandable details
  - Paint condition tracking with visual gradient slider
  - Anode inspection reports
  - Propeller condition tracking
  - Service videos and YouTube playlist integration
- **Invoices** - View and download invoices, payment history
- **Authentication** - Supabase Auth with secure login/signup
- **Multi-Boat Support** - Boat selector for customers with multiple vessels
- **Admin View** - Admin users can view all boats in the system

### Data Features
- Paint condition range interpretation (e.g., "Fair-Poor")
- Latest paint inspection tracking (independent of most recent service)
- Growth level tracking
- Through-hull condition monitoring
- Service media integration

---

## 🚧 Future Features (Phase 2+)

### Communication & Requests

#### **Messages** (Priority: High)
**Status:** Navigation removed, awaiting implementation

Real-time messaging between customers and Sailor Skills team.

**Features:**
- Thread-based conversations
- File attachments (photos, documents)
- Read receipts
- Email notifications for new messages
- Mobile-friendly interface

**Technical Considerations:**
- Use Supabase Realtime for live updates
- Implement file storage with Supabase Storage
- Consider message search/filtering

---

#### **Request Service** (Priority: High)
**Status:** Navigation removed, awaiting implementation

Allow customers to request new services directly through the portal.

**Features:**
- Service type selection (haul-out, bottom clean, anode replacement, etc.)
- Preferred date/time selection
- Special instructions field
- Photo upload capability
- Request status tracking
- Email confirmation

**Workflow:**
1. Customer submits request
2. Admin receives notification
3. Admin reviews and responds via Messages
4. Service gets scheduled
5. Customer receives confirmation

**Technical Considerations:**
- Service request queue/dashboard for admin
- Calendar integration for scheduling
- Notification system (email + in-app)

---

#### **Request History** (Priority: Medium)
**Status:** Navigation removed, awaiting implementation

View history of all service requests (pending, approved, completed, cancelled).

**Features:**
- List view of all requests
- Filter by status (pending, scheduled, completed, cancelled)
- Request details modal
- Link to related service log (once completed)
- Resubmit functionality for repeated services

**Data Model:**
```
service_requests
- id
- boat_id
- customer_account_id
- service_type
- requested_date
- preferred_time
- status (pending, approved, scheduled, completed, cancelled)
- special_instructions
- photos (json array)
- created_at
- updated_at
- scheduled_date (once approved)
- service_log_id (once completed)
```

---

### Account Management

#### **Account Settings / Notification Preferences** (Priority: Medium)
**Status:** Navigation removed, awaiting implementation

Allow customers to manage their account settings and communication preferences.

**Features:**

**Profile Information:**
- Name
- Email
- Phone number
- Preferred contact method

**Notification Preferences:**
- Email notifications
  - Service reminders
  - New invoices
  - New messages
  - Service request updates
- SMS notifications (future)
- Frequency settings (immediate, daily digest, weekly summary)

**Additional Settings:**
- Password change
- Two-factor authentication (future)
- Linked boats management
- Timezone preferences

**Technical Considerations:**
- Update `customer_accounts` table
- Create `notification_preferences` table
- Implement notification queue system
- Email service integration (SendGrid, Mailgun, etc.)

---

## 📊 Analytics & Reporting (Phase 3)

### Customer Analytics
- Service frequency tracking
- Spending history graphs
- Paint condition trends over time
- Seasonal service patterns
- Maintenance cost predictions

### Admin Analytics Dashboard
- Customer engagement metrics
- Popular service types
- Revenue tracking
- Average service intervals
- Customer satisfaction tracking

---

## 🎨 UX Improvements (Ongoing)

### Mobile Optimization
- [ ] Responsive design improvements for tablets
- [ ] Native mobile app consideration (React Native?)
- [ ] Touch-optimized video controls
- [ ] Swipeable service history cards

### Accessibility
- [ ] ARIA labels for screen readers
- [ ] Keyboard navigation support
- [ ] High contrast mode
- [ ] Font size preferences

### Performance
- [ ] Image optimization and lazy loading
- [ ] Service history pagination
- [ ] Caching strategy for frequently accessed data
- [ ] Progressive web app (PWA) features

---

## 🔐 Security & Compliance (Ongoing)

- [ ] GDPR compliance features
- [ ] Data export functionality
- [ ] Account deletion request flow
- [ ] Audit logging for sensitive operations
- [ ] Rate limiting for API endpoints
- [ ] Two-factor authentication

---

## 🧪 Testing & Quality

- [ ] Automated end-to-end tests (Playwright)
- [ ] Unit tests for critical business logic
- [ ] Visual regression testing
- [ ] Performance monitoring
- [ ] Error tracking (Sentry)
- [ ] User feedback collection system

---

## 📅 Suggested Timeline

**Q1 2025:**
- ✅ Phase 1 Core Features (Complete)
- Messages system implementation
- Request Service implementation

**Q2 2025:**
- Request History implementation
- Account Settings & Notification Preferences
- Mobile optimization improvements

**Q3 2025:**
- Analytics & Reporting features
- Advanced notification system
- Performance optimizations

**Q4 2025:**
- Security enhancements
- Compliance features
- Native mobile app evaluation

---

## 🎯 Success Metrics

### Customer Satisfaction
- Portal adoption rate (% of customers using vs. email/phone)
- Average session duration
- Feature usage analytics
- Customer feedback scores

### Business Impact
- Reduction in support emails/calls
- Faster service request processing
- Improved payment collection time
- Customer retention rates

### Technical Metrics
- Page load times < 2 seconds
- 99.9% uptime
- Zero critical security vulnerabilities
- Mobile usability score > 90

---

## 📝 Notes

- This roadmap is subject to change based on customer feedback and business priorities
- Features may be added, removed, or reprioritized as needed
- Technical feasibility will be evaluated before implementation
- User testing will guide final feature designs

---

**Last Updated:** January 6, 2025
**Owner:** Sailor Skills Development Team
**Review Frequency:** Monthly
