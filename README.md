# Project: Multi-Restaurant Online Ordering Platform

## Context
I'm building a web platform that allows independent restaurants to accept online orders without paying high commissions (like the 30% charged by DoorDash or Uber Eats). Each restaurant can display its own menu, and customers can place orders through a simple interface.

The platform is **multi-tenant**: a single codebase for multiple restaurants, with dynamic customization of menus, branding, and colors.

Examples:
- `mysite.com/restaurant/restaurant1`
- `mysite.com/restaurant/restaurant2`

## Project Components

### Frontend (Customer-facing)
- Mobile-first ordering website
- Menu display (category and item listing)
- Cart system
- Checkout with customer info (name, phone, address)
- Order confirmation page
- Optional: Online payment integration

### Backend API
- Multi-restaurant architecture (restaurants each have menus, orders, etc.)
- CRUD endpoints for restaurants, menus, items, and orders
- Authentication for managers/staff
- Real-time notifications (WebSockets or similar) for incoming orders
- Optional: Integration with Stripe or other payment gateway

### Admin App (Restaurant-side)
- Web or mobile app
- Real-time list of incoming orders
- Order detail view (items, customer info, delivery note)
- Order actions: mark as preparing, ready, completed
- Menu management (CRUD for items and categories)
- Restaurant settings (hours, delivery zones, etc.)

## Planned Tech Stack
- Backend: Node.js / Express, or Ruby on Rails
- Frontend: React or Next.js
- Database: PostgreSQL or Supabase
- Real-time notifications: WebSockets or Pusher
- Deployment: Docker, Render, Railway, or similar

## Copilot's Role
- Generate models, controllers, and REST APIs
- Suggest folder structures suitable for a multi-tenant setup
- Create reusable components in React for dynamic restaurant views
- Assist with logic for order management (backend and frontend)
- Help with tests, seed data, and API docs

## Notes
- Code should be clean, reusable, and scalable
- Focus on MVP first (core ordering functionality, admin dashboard)
- Advanced features can be added later (payment, analytics, POS integration)
