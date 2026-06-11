# 🎙️ The Katanguri's Kitchen — Demo Narration Script

> **Instructions for recording:** Play the video while reading this script at each scene. Record your voice using any screen recorder (OBS, Loom, or phone) with the video playing. Then merge audio + video using any video editor.

---

## 📹 Part 1: Customer Web App (0:00 – 5:00)

### Scene 1: Homepage Hero (0:00 – 0:30)
**📸 Screenshot: 01-web-homepage-hero.png**

> "Welcome to The Katanguri's Kitchen — Warangal's Favorite Kitchen. This is a complete food ordering platform built with Next.js, featuring real-time order tracking, AI-powered recommendations, and a modern admin dashboard. As you can see, the homepage features a clean hero section with the brand tagline and a call-to-action to order."

### Scene 2: Stats Bar (0:30 – 0:50)
**📸 Screenshot: 02-web-homepage-stats.png**

> "Below the hero, we display key statistics — over 50 dishes, 30-minute average delivery, and a 4.8-star rating. These stats are pulled live from the database."

### Scene 3: Category Browser (0:50 – 1:10)
**📸 Screenshot: 03-web-homepage-categories.png**

> "Customers can browse menu categories with beautiful food photography — Non-Veg Starters, Veg Curries, Biryani, Chinese, Desserts, and more. Each category shows the number of available items."

### Scene 4: Popular Dishes (1:10 – 1:40)
**📸 Screenshot: 04-web-homepage-dishes.png**

> "The Popular Dishes section highlights top items with high-quality images, prep time, pricing, and one-click Add to Cart. Notice the VEG and NON-VEG badges for easy identification."

### Scene 5: How It Works (1:40 – 2:00)
**📸 Screenshot: 05-web-homepage-how-it-works.png**

> "A simple 3-step process: Choose from the menu, Order with secure payment, and Enjoy real-time tracking — all delivered hot to your doorstep."

### Scene 6: Features & CTA (2:00 – 2:20)
**📸 Screenshot: 06-web-homepage-cta.png**

> "We highlight our key differentiators — free delivery on orders above ₹500, fresh-to-order cooking, quality-assured ingredients, and live tracking. The banner CTA drives conversions."

---

### Scene 7: Menu Page — Full View (2:20 – 2:50)
**📸 Screenshot: 07-web-menu-full.png**

> "The Menu page is the heart of the customer experience. It loads all dishes from the API with real-time availability updates via Server-Sent Events. Notice the category filter pills, search bar, and sort options."

### Scene 8: Search (2:50 – 3:10)
**📸 Screenshot: 08-web-menu-search.png**

> "Real-time search instantly filters dishes as you type. Searching 'biryani' shows only biryani options."

### Scene 9: Category Filter (3:10 – 3:30)
**📸 Screenshot: 09-web-menu-category-filter.png**

> "Category filters let customers narrow down by cuisine type. Each category pill is easily toggleable."

### Scene 10: Sort & Add to Cart (3:30 – 4:00)
**📸 Screenshot: 10-web-menu-sorted.png**

> "Sort by popularity, AI-powered 'For You' recommendations, price ascending, or descending. When we add items to cart, they instantly appear with smooth animations."

---

### Scene 11: Cart Page (4:00 – 4:20)
**📸 Screenshot: 13-web-cart-with-items.png**

> "The cart shows all selected items with quantity steppers, individual prices, and a running subtotal. Free delivery is automatically applied for orders above ₹500. The order summary is sticky on desktop for easy checkout."

### Scene 12: Authentication (4:20 – 4:45)
**📸 Screenshot: 14-web-auth-login.png**

> "The authentication page supports both phone OTP and email OTP login. It includes security features like rate limiting, attempt tracking, and OTP expiry. The login/signup toggle is seamless."

### Scene 13: Order Tracking (4:45 – 5:00)
**📸 Screenshot: 18-web-track-empty.png**

> "Order tracking uses Server-Sent Events for real-time status updates. Customers enter their order ID and see a live progress timeline with a map showing the delivery rider's position."

---

## 🖥️ Part 2: Admin Dashboard (5:00 – 10:00)

### Scene 14: Admin Login (5:00 – 5:20)
**📸 Screenshot: 20-admin-login.png**

> "The Admin Dashboard is a separate application with email-password authentication. It's accessible at port 3002 with a clean, professional login interface."

### Scene 15: Dashboard Overview (5:20 – 6:00)
**📸 Screenshot: 22-admin-dashboard.png**

> "The dashboard provides a bird's-eye view with four key metrics: Revenue Today, Orders Today, Active Orders, and Automation Rate. The real-time event monitor shows live system events as they happen. The recent orders table auto-refreshes with every status change."

### Scene 16: Kitchen Display System (6:00 – 6:40)
**📸 Screenshot: 24-admin-kds.png**

> "The Kitchen Display System — or KDS — is a Kanban-style board optimized for kitchen screens. Orders flow from New → Confirmed → Preparing → Ready. Each card shows the order details, timing, and a one-click action button to advance the order. New orders flash with an alert animation."

### Scene 17: Orders Management (6:40 – 7:10)
**📸 Screenshot: 25-admin-orders.png**

> "The Orders Management page shows all orders in a filterable data table. Status filters let admins quickly find orders by state. Each order has action buttons to advance it through the workflow: Confirm, Start Preparing, Mark Ready, Dispatch, or Cancel. Status updates propagate in real-time to the customer app."

### Scene 18: Menu Management (7:10 – 7:40)
**📸 Screenshot: 26-admin-menu.png**

> "Admins can manage the full menu — create and deactivate categories, add dishes with pricing and prep times, toggle availability, upload images, and delete items. Changes are reflected instantly on the customer-facing app via real-time events."

### Scene 19: Inventory Management (7:40 – 8:00)
**📸 Screenshot: 27-admin-inventory.png**

> "The Inventory page tracks all ingredients with stock levels, minimum thresholds, and cost tracking. Low stock items are highlighted in red. The stock adjustment buttons allow quick increments, and all transactions are logged."

### Scene 20: Analytics (8:00 – 8:20)
**📸 Screenshot: 28-admin-analytics.png**

> "Analytics provides revenue tracking, order volumes, average order value, and completion rates. The order status breakdown shows the distribution across all stages. Data can be viewed for today, this week, or this month."

### Scene 21: AI Insights — Sentiment Analysis (8:20 – 8:50)
**📸 Screenshot: 29-admin-ai-sentiment.png**

> "AI Insights is powered by sentiment analysis and demand forecasting. The sentiment tab analyzes customer feedback, showing positive, neutral, and negative distributions with keyword extraction and top complaint themes."

### Scene 22: AI Insights — Demand Forecast (8:50 – 9:10)
**📸 Screenshot: 30-admin-ai-forecast.png**

> "The demand forecast predicts daily orders and revenue using historical data. It provides prep recommendations — telling the kitchen which dishes to prepare in what quantities for each day."

### Scene 23: Automation (9:10 – 9:30)
**📸 Screenshot: 31-admin-automation.png**

> "The Automation engine lets admins create custom rules with triggers, conditions, and actions. Built-in workflows include order-to-kitchen, payment confirmation, dispatch assignment, and inventory alerts — all toggleable."

### Scene 24: Delivery Zones (9:30 – 9:50)
**📸 Screenshot: 32-admin-delivery.png**

> "Delivery Zones are configured on an interactive Leaflet map. Admins can define circular zones with custom fees, minimum orders, and estimated delivery times. The location validator tool checks if any address falls within the delivery radius."

### Scene 25: Customers (9:50 – 10:00)
**📸 Screenshot: 33-admin-customers.png**

> "The Customers page shows all registered users with their order counts, total spend, and loyalty status — automatically tagging regular customers with 5+ orders."

### Scene 26: Live Rider Map (10:00 – 10:20)
**📸 Screenshot: 34-admin-riders-map.png**

> "The Live Rider Map uses Leaflet to display all active delivery riders in real-time. Each rider shows their position, speed, ETA, and order details. The simulation tool lets admins test the delivery tracking flow."

### Scene 27: Settings (10:20 – 10:35)
**📸 Screenshot: 35-admin-settings.png**

> "Settings provide centralized configuration — restaurant details, delivery fees, order automation, payment timeouts, and notification preferences. Changes take effect immediately."

### Scene 28: Webhooks Hub (10:35 – 11:00)
**📸 Screenshot: 36-admin-webhooks.png**

> "The Webhooks Hub provides complete observability into event delivery. Sub-pages include analytics for delivery rates and latency, health monitoring, configurable alerts, and a replay tool for retrying failed webhooks."

---

## 🎬 Closing (11:00 – 11:30)

> "The Katanguri's Kitchen is a production-ready food delivery platform with real-time capabilities across the entire stack — from live order tracking on the customer side to real-time kitchen display and rider monitoring on the admin side. Built with Next.js, Express, PostgreSQL, Redis, and Server-Sent Events for a seamless real-time experience. Thank you for watching."

---

## 📋 Recording Tips

1. **Screen Recording Software:** Use OBS Studio (free), Loom, or any screen recorder
2. **Resolution:** Record at 1920x1080 or 1440x900 for best quality
3. **Browser:** Use Chrome in full-screen mode (F11)
4. **Pacing:** Follow the timestamps, pausing where indicated
5. **Audio:** Use a good microphone; speak clearly and at a moderate pace
6. **Post-production:** Add transitions between parts using any video editor (CapCut, DaVinci Resolve, or even PowerPoint export)
